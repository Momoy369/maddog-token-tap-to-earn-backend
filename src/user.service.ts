import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as moment from 'moment';
import {
  Connection,
  clusterApiUrl,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class UserService {
  async getEnergy(telegramId: string) {
    const user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    return { energy: user.energy };
  }
  private SPL_TOKEN_MINT_ADDRESS =
    'mntv2Hgsa3D8KhjPmQbCTefph17cJMuW4ZT1cGFg5FH';

  private totalDistributed = 0;

  private MAX_AIRDROP_SUPPLY = 200_000_000 * 0.2;

  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async tap(telegramId: string, tapCount: number = 1) {
    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user) return null;

    user = this.updateUserEnergy(user);

    if (user.energy < tapCount) {
      return {
        error: 'Energi tidak cukup! Tunggu hingga energi terisi kembali.',
      };
    }

    user.balance += tapCount; // Tambah poin sesuai jumlah tap
    user.energy -= tapCount; // Kurangi energi sesuai jumlah tap
    await this.userRepo.save(user);

    return {
      balance: user.balance,
      energy: user.energy,
    };
  }

  private updateUserEnergy(user: User): User {
    const ENERGY_MAX = 50000;
    const REFILL_TIME_HOURS = 3;

    const lastUpdate = user.lastEnergyUpdate
      ? moment(user.lastEnergyUpdate)
      : moment().subtract(REFILL_TIME_HOURS, 'hours');

    const now = moment();
    const hoursSinceLastUpdate = now.diff(lastUpdate, 'hours', true);

    if (hoursSinceLastUpdate >= REFILL_TIME_HOURS) {
      user.energy = ENERGY_MAX;
    }

    user.lastEnergyUpdate = now.toDate();
    return user;
  }

  async withdraw(telegramId: string, walletAddress: string) {
    if (!process.env.SOLANA_PRIVATE_KEY) {
      throw new Error(
        'SOLANA_PRIVATE_KEY is not defined in environment variables!',
      );
    }

    const privateKeyString = process.env.SOLANA_PRIVATE_KEY;
    const privateKeyArray = JSON.parse(privateKeyString);
    const payer = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user || user.balance < 1_000_000) {
      return { error: 'Saldo tidak cukup untuk withdraw.' };
    }

    const now = moment().utc();
    const lastWithdraw = moment(user.lastWithdraw || 0);

    if (lastWithdraw.isValid() && now.diff(lastWithdraw, 'hours') < 24) {
      return { error: 'Tunggu 24 jam sebelum withdraw berikutnya!' };
    }

    const splAmount = this.convertPointsToSpl(user.balance);
    if (this.totalDistributed + splAmount > this.MAX_AIRDROP_SUPPLY) {
      return { error: 'Airdrop limit telah tercapai!' };
    }

    const estimatedFee = await this.estimateTransactionFee();
    const solBalance = await this.checkSolBalance(walletAddress);

    if (solBalance < estimatedFee) {
      return {
        error: `Saldo SOL tidak cukup untuk biaya transaksi! Dibutuhkan sekitar ${estimatedFee} SOL.`,
      };
    }

    try {
      const transactionResult = await this.sendSplTokenToUser(
        walletAddress,
        splAmount,
        payer,
      );

      user.balance = 0;
      user.lastWithdraw = now.toDate();
      this.totalDistributed += splAmount;
      await this.userRepo.save(user);

      return {
        success: 'Withdraw berhasil!',
        transactionId: transactionResult.transactionId,
      };
    } catch (error) {
      console.error('Error during sending SPL token:', error);
      return { error: 'Terjadi kesalahan saat mengirimkan SPL token.' };
    }
  }

  private async estimateTransactionFee(): Promise<number> {
    const connection = new Connection(
      clusterApiUrl('mainnet-beta'),
      'confirmed',
    );
    const transaction = new Transaction();
    const feeInfo = await connection.getFeeForMessage(
      transaction.compileMessage(),
    );

    const feeLamports = feeInfo.value ?? 5000;

    return feeLamports / 10 ** 9;
  }

  private convertPointsToSpl(points: number): number {
    return points / 100_000;
  }

  private async checkSolBalance(walletAddress: string): Promise<number> {
    const connection = new Connection(
      clusterApiUrl('mainnet-beta'),
      'confirmed',
    );
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    return balance / 10 ** 9;
  }

  private async sendSplTokenToUser(
    walletAddress: string,
    splAmount: number,
    payer: Keypair,
  ) {
    const connection = new Connection(
      clusterApiUrl('mainnet-beta'),
      'confirmed',
    );
    const mintAddress = new PublicKey(this.SPL_TOKEN_MINT_ADDRESS);
    const receiver = new PublicKey(walletAddress);

    const payerTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      payer.publicKey,
    );
    const receiverTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      receiver,
    );

    const receiverAccountInfo =
      await connection.getAccountInfo(receiverTokenAccount);
    if (!receiverAccountInfo) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          receiverTokenAccount,
          receiver,
          mintAddress,
        ),
      );
      await connection.sendTransaction(transaction, [payer]);
    }

    const transaction = new Transaction().add(
      createTransferInstruction(
        payerTokenAccount,
        receiverTokenAccount,
        payer.publicKey,
        Math.round(splAmount * 10 ** 9),
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    const signature = await connection.sendTransaction(transaction, [payer]);
    await connection.confirmTransaction(signature, 'confirmed');

    return { transactionId: signature };
  }

  async getLeaderboard() {
    return await this.userRepo.find({
      select: ['telegramId', 'balance', 'username'],
      order: { balance: 'DESC' },
      take: 10,
    });
  }

  async claimDailyReward(telegramId: string) {
    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user) return { error: 'User tidak ditemukan!' };

    const now = moment().utc();
    const lastClaim = moment(user.lastClaimed || 0);

    if (lastClaim.isValid() && lastClaim.isSame(now, 'day')) {
      return { error: 'Anda sudah klaim hari ini!' };
    }

    user.balance += 200;
    user.lastClaimed = now.toDate();
    await this.userRepo.save(user);
    return { success: 'Klaim berhasil!', balance: user.balance };
  }

  async register(telegramId: string, referrerId?: string) {
    let user = await this.userRepo.findOne({ where: { telegramId } });

    if (!user) {
      user = this.userRepo.create({
        telegramId,
        balance: 100,
        wallet: `TEMP_${telegramId}`,
        referralCode: `REF-${telegramId}`,
        lastWithdraw: null,
        lastClaimed: null,
        referrerId: referrerId || '',
        hasUsedReferral: referrerId ? true : false, // langsung set jika ada referrer
      });

      await this.userRepo.save(user);

      if (referrerId) {
        await this.processReferral(referrerId);
      }
    }

    return {
      telegramId: user.telegramId,
      balance: user.balance,
      referralCode: user.referralCode,
      lastWithdraw: user.lastWithdraw || null,
      lastClaimed: user.lastClaimed || null,
    };
  }

  private async processReferral(referrerId: string) {
    const referrer = await this.userRepo.findOne({
      where: { telegramId: referrerId },
    });

    if (!referrer) {
      console.error(`Referral ID tidak valid: ${referrerId}`);
      return;
    }

    referrer.balance += 500;
    await this.userRepo.save(referrer);

    try {
      await this.sendMessageToTelegram(
        referrer.telegramId,
        '🎉 Pengguna baru telah bergabung melalui referral Anda! Saldo Anda bertambah 500 poin.',
      );
    } catch (error) {
      console.error('Gagal mengirim pesan ke Telegram:', error);
    }
  }

  async sendMessageToTelegram(telegramId: string, message: string) {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken)
        throw new Error('Bot token tidak ditemukan di environment variables!');

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await axios.post(url, { chat_id: telegramId, text: message });
    } catch (error) {
      console.error('Error saat mengirim pesan Telegram:', error);
    }
  }
}
