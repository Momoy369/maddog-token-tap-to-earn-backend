import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Ambil data user berdasarkan wallet.
 */
export async function getUser(wallet) {
  const { rows } = await pool.query('SELECT * FROM users WHERE wallet = $1', [
    wallet,
  ]);
  return rows[0] || null;
}

/**
 * Buat user baru jika tidak ditemukan.
 */
export async function createUser(telegramId, wallet) {
  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, wallet, balance) 
     VALUES ($1, $2, 0) 
     ON CONFLICT (wallet) DO NOTHING RETURNING *`,
    [telegramId, wallet],
  );
  return rows[0] || null;
}

/**
 * Perbarui waktu withdraw terakhir user.
 */
export async function updateUserWithdrawTime(wallet) {
  await pool.query(
    `UPDATE users 
     SET last_withdraw = NOW() 
     WHERE wallet = $1`,
    [wallet],
  );
}

/**
 * Update saldo user.
 */
export async function updateUserBalance(wallet, amount) {
  await pool.query(
    `UPDATE users 
     SET balance = balance + $1 
     WHERE wallet = $2`,
    [amount, wallet],
  );
}
