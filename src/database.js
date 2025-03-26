import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getUser(wallet) {
  const { rows } = await pool.query('SELECT * FROM users WHERE wallet = $1', [
    wallet,
  ]);
  return rows[0] || null;
}

export async function createUser(telegramId, wallet) {
  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, wallet, balance) 
     VALUES ($1, $2, 0) 
     ON CONFLICT (wallet) DO NOTHING RETURNING *`,
    [telegramId, wallet],
  );
  return rows[0] || null;
}

export async function updateUserWithdrawTime(wallet) {
  await pool.query(
    `UPDATE users 
     SET last_withdraw = NOW() 
     WHERE wallet = $1`,
    [wallet],
  );
}

export async function updateUserBalance(wallet, amount) {
  await pool.query(
    `UPDATE users 
     SET balance = balance + $1 
     WHERE wallet = $2`,
    [amount, wallet],
  );
}
