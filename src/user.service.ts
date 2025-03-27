import { Injectable } from '@nestjs/common';
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
      user = new User(); // <--- Gunakan cara ini jika error tetap ada
      user.telegramId = telegramId;
      user.balance = 100;
      user.wallet = `TEMP_${telegramId}`;
      user.referralCode = `REF-${telegramId}`;
      user.lastWithdraw = null;
      user.lastClaimed = null;
      user.referrerId = referrerId || '';

      await this.userRepo.save(user);

      if (referrerId) {
        const referrer = await this.userRepo.findOne({
          where: { telegramId: referrerId },
        });
        if (referrer) {
          referrer.balance += 35; // Bonus referral
          await this.userRepo.save(referrer);
        }
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
}
