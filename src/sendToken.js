import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

// Middleware untuk cek nonce
const checkNonce = async (req, res, next) => {
  const { telegramId, nonce } = req.body;

  // Cek nonce di database
  const user = await User.findOne({ where: { telegram_id: telegramId } });

  if (!user || user.nonce !== nonce) {
    return res.status(400).json({ error: 'Nonce salah atau kadaluarsa' });
  }

  // Nonce sudah terpakai, hapus dari database
  user.nonce = null;
  await user.save();

  next(); // Lanjutkan ke proses withdraw
};

// Endpoint untuk request withdraw dengan nonce
app.post('/request-withdraw', async (req, res) => {
  const { telegramId } = req.body;

  // Generate nonce acak
  const nonce = Math.floor(100000 + Math.random() * 900000).toString();

  // Simpan nonce di database
  const user = await User.findOne({ where: { telegram_id: telegramId } });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  user.nonce = nonce;
  await user.save();

  // Kirim nonce ke user lewat bot Telegram
  sendTelegramMessage(telegramId, `Kode konfirmasi withdraw Anda: ${nonce}`);

  res.json({ message: 'Kode konfirmasi dikirim ke Telegram Anda.' });
});

// Endpoint withdraw (harus memasukkan nonce)
app.post('/withdraw', checkNonce, async (req, res) => {
  const { telegramId, wallet } = req.body;

  // Panggil smart contract untuk withdraw
  const result = await sendWithdrawTransaction(wallet);

  res.json({ message: 'Withdraw berhasil dikirim!', result });
});
