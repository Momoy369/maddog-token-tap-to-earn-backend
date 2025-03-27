import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as moment from 'moment';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async tap(telegramId: string) {
    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user) return null;

    user.balance += 1;
    await this.userRepo.save(user);
    return user;
  }

  async withdraw(telegramId: string, walletAddress: string) {
    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user || user.balance < 50000) {
      return { error: 'Saldo tidak cukup untuk withdraw.' };
    }

    const now = moment().utc();
    const lastWithdraw = moment(user.lastWithdraw || 0);

    if (lastWithdraw.isValid() && now.diff(lastWithdraw, 'hours') < 24) {
      return { error: 'Tunggu 24 jam sebelum withdraw berikutnya!' };
    }

    user.balance -= 50000;
    user.lastWithdraw = now.toDate();
    await this.userRepo.save(user);

    return {
      balance: user.balance,
      lastWithdraw: user.lastWithdraw,
    };
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
    const botToken = 'YOUR_BOT_TOKEN';
    const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${telegramId}&text=${encodeURIComponent(message)}`;
    await axios.get(url);
  }
}
