import { Injectable } from '@nestjs/common';
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
  private CONVERSION_RATIO = 0.0001; // 1 meme coin = 0.0001 SPL token
  private SPL_TOKEN_MINT_ADDRESS =
    'mntv2Hgsa3D8KhjPmQbCTefph17cJMuW4ZT1cGFg5FH';

  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async tap(telegramId: string) {
    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user) return null;

    user.balance += 1;
    await this.userRepo.save(user);
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
    if (!user || user.balance < 50000) {
      return { error: 'Saldo tidak cukup untuk withdraw.' };
    }

    const now = moment().utc();
    const lastWithdraw = moment(user.lastWithdraw || 0);

    if (lastWithdraw.isValid() && now.diff(lastWithdraw, 'hours') < 24) {
      return { error: 'Tunggu 24 jam sebelum withdraw berikutnya!' };
    }

    const splAmount = this.convertMemeCoinToSpl(user.balance);

    const solBalance = await this.checkSolBalance(user.wallet);
    if (solBalance < 0.001) {
      return { error: 'Saldo SOL tidak cukup untuk biaya transaksi.' };
    }

    user.balance -= 50000;
    user.lastWithdraw = now.toDate();
    await this.userRepo.save(user);

    try {
      const transactionResult = await this.sendSplTokenToUser(
        walletAddress,
        splAmount,
        payer,
      );
      return {
        success: 'Withdraw berhasil!',
        balance: user.balance,
        transactionId: transactionResult.transactionId,
      };
    } catch (error) {
      console.error('Error during sending SPL token:', error);
      return { error: 'Terjadi kesalahan saat mengirimkan SPL token.' };
    }
  }

  private convertMemeCoinToSpl(memeCoinAmount: number): number {
    return memeCoinAmount * this.CONVERSION_RATIO;
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

    try {
      await connection.getAccountInfo(receiverTokenAccount);
    } catch (e) {
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
        splAmount * 10 ** 9,
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
        hasUsedReferral: false,
      });

      await this.userRepo.save(user);

      if (referrerId) {
        const referrer = await this.userRepo.findOne({
          where: { telegramId: referrerId },
        });

        if (!referrer) {
          throw new Error('Referral ID tidak valid');
        }

        if (user.hasUsedReferral) {
          throw new Error('Anda sudah menggunakan kode referral sebelumnya');
        }

        referrer.balance += 500;
        await this.userRepo.save(referrer);

        user.hasUsedReferral = true;
        await this.userRepo.save(user);

        await this.sendMessageToTelegram(
          referrer.telegramId,
          '🎉 Pengguna baru telah bergabung melalui referral Anda! Saldo Anda bertambah 500 poin.',
        );
      }
    } else {
      if (referrerId) {
        if (user.hasUsedReferral) {
          throw new Error('Anda sudah menggunakan kode referral sebelumnya');
        }

        const referrer = await this.userRepo.findOne({
          where: { telegramId: referrerId },
        });
        if (!referrer) {
          throw new Error('Referral ID tidak valid');
        }

        referrer.balance += 500;
        await this.userRepo.save(referrer);

        user.hasUsedReferral = true;
        await this.userRepo.save(user);

        await this.sendMessageToTelegram(
          referrer.telegramId,
          '🎉 Pengguna baru telah bergabung melalui referral Anda! Saldo Anda bertambah 500 poin.',
        );
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

  async sendMessageToTelegram(telegramId: string, message: string) {
    const botToken = '8147895010:AAFae3317MytJ7yjdq9LNAljip5ohekzEIw';
    const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${telegramId}&text=${encodeURIComponent(message)}`;
    await axios.get(url);
  }
}
