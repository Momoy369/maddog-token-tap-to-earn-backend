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
    if (!user || user.balance < 1000) return null;

    const now = moment().utc();
    const lastWithdraw = moment(user.lastWithdraw || 0);
    if (lastWithdraw.isValid() && now.diff(lastWithdraw, 'hours') < 24) {
      return { error: 'Tunggu 24 jam sebelum withdraw berikutnya!' };
    }

    user.balance -= 1000;
    user.lastWithdraw = now.toDate();
    await this.userRepo.save(user);

    return user;
  }

  async getLeaderboard() {
    return await this.userRepo.find({
      order: { balance: 'DESC' },
      take: 10,
    });
  }

  async claimDailyReward(telegramId: string) {
    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user) return null;

    const now = moment().utc();
    const lastClaim = moment(user.lastClaimed || 0);

    if (lastClaim.isSame(now, 'day')) return null;

    user.balance += 20;
    user.lastClaimed = now.toDate();
    await this.userRepo.save(user);
    return user;
  }

  async register(telegramId: string, referrerId?: string) {
    let user = await this.userRepo.findOne({ where: { telegramId } });

    if (!user) {
      user = this.userRepo.create({ telegramId, balance: 100 });
      if (referrerId) {
        user.referrerId = referrerId;
        const referrer = await this.userRepo.findOne({
          where: { telegramId: referrerId },
        });
        if (referrer) {
          referrer.balance += 35;
          await this.userRepo.save(referrer);
        }
      }
      await this.userRepo.save(user);
    }
    return user;
  }
}
