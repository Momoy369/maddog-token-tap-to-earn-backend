import { DataSource } from 'typeorm';
import 'dotenv/config'; // Pastikan env bisa dibaca

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity{.ts,.js}'], // Pastikan entity masuk
  migrations: ['src/migrations/*.ts'], // Lokasi file migration
  synchronize: false,
});

export default dataSource;
