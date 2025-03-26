import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';

interface User {
  id: string;
  balance: number;
  lastTapTime: Date | null;
}

@Controller('game')
export class GameController {
  private logger = new Logger('TapFrenzy');

  @Post('tap-frenzy')
  async tapFrenzy(
    @Body() { telegramId, taps }: { telegramId: string; taps: number },
  ) {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) throw new BadRequestException('User tidak ditemukan');

    const now = new Date();
    const lastTapTime = user.lastTapTime ? new Date(user.lastTapTime) : null;

    if (lastTapTime && now.getTime() - lastTapTime.getTime() < 1000) {
      throw new BadRequestException('Terlalu cepat! Tunggu 1 detik antar tap.');
    }

    const maxTapsPerSession = 50;
    const rewardPerTap = 2;
    const validTaps = Math.min(taps, maxTapsPerSession);
    user.balance += validTaps * rewardPerTap;
    user.lastTapTime = now;

    await this.updateUser(user);

    return { balance: user.balance, reward: validTaps * rewardPerTap };
  }

  // Metode simulasi untuk mendapatkan user
  private async getUserByTelegramId(telegramId: string): Promise<User> {
    return { id: telegramId, balance: 100, lastTapTime: null };
  }

  // Metode simulasi untuk memperbarui user
  private async updateUser(user: any) {
    return user; // Simulasi update user
  }
}
