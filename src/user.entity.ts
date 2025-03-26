import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index() 
  @Column({ unique: true })
  telegramId: string;

  @Index()
  @Column({ unique: true })
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

  @Column({ type: 'timestamp', nullable: true })
  referrerId: string;
  lastClaimed: Date;
}
