import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // Tambahkan entitas UserEntity
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Tambahkan ini jika UserService digunakan di module lain
})
export class UserModule {}
