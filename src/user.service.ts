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
    if (!user) return { error: 'User tidak ditemukan!' };

    if (user.balance < 50000) {
      return { error: 'Minimal withdraw adalah 50.000 poin!' };
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
      message: 'Withdraw berhasil!',
      newBalance: user.balance,
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
      return { error: 'Daily reward sudah diklaim hari ini!' };
    }

    user.balance += 20;
    user.lastClaimed = now.toDate();
    await this.userRepo.save(user);

    return {
      message: 'Daily reward berhasil diklaim!',
      newBalance: user.balance,
      lastClaimed: user.lastClaimed,
    };
  }

  async register(telegramId: string, referrerId?: string) {
  let user = await this.userRepo.findOne({ where: { telegramId } });

  if (!user) {
    user = new User();
    user.telegramId = telegramId;
    user.balance = 100;
    user.wallet = `TEMP_${telegramId}`;
    user.referrerId = referrerId || undefined;
    user.lastWithdraw = undefined;
    user.lastClaimed = undefined;

    if (referrerId) {
      const referrer = await this.userRepo.findOne({ where: { telegramId: referrerId } });
      if (referrer) {
        referrer.balance += 35;
        await this.userRepo.save(referrer);
      }
    }
    await this.userRepo.save(user);
  }

  return {
    telegramId: user.telegramId,
    balance: user.balance,
    wallet: user.wallet,
    referralCode: user.telegramId,
    lastWithdraw: user.lastWithdraw,
    lastClaimed: user.lastClaimed,
  };
}

}
