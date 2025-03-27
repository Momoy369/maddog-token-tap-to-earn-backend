import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ unique: true })
  telegramId: string;

  @Index()
  @Column({ unique: true, nullable: false })
  wallet: string;

  @Column({ default: 0 })
  balance: number;

  @Column({ type: 'timestamp', nullable: true })
  lastTapTime: Date;

  @Index()
  @Column({ type: 'timestamp', nullable: true })
  lastWithdraw: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ nullable: true })
  referrerId: string;

  @Column({ type: 'timestamp', nullable: true })
  lastClaimed: Date;

  @Column({ nullable: true })
  referralCode: string;
}
