import { Controller, Post, Body, Get } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body('telegramId') telegramId: string) {
    return await this.userService.register(telegramId);
  }

  @Post('tap')
  async tap(@Body('telegramId') telegramId: string) {
    return await this.userService.tap(telegramId);
  }

  @Post('withdraw')
  async withdraw(
    @Body('telegramId') telegramId: string,
    @Body('wallet') wallet: string,
  ) {
    return await this.userService.withdraw(telegramId, wallet);
  }

  @Get('leaderboard')
  async leaderboard() {
    return await this.userService.getLeaderboard();
  }
}
