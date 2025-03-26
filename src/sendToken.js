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

const checkNonce = async (req, res, next) => {
  const { telegramId, nonce } = req.body;

  const user = await User.findOne({ where: { telegram_id: telegramId } });

  if (!user || user.nonce !== nonce) {
    return res.status(400).json({ error: 'Nonce salah atau kadaluarsa' });
  }

  user.nonce = null;
  await user.save();

  next();
};

app.post('/request-withdraw', async (req, res) => {
  const { telegramId } = req.body;

  const nonce = Math.floor(100000 + Math.random() * 900000).toString();

  const user = await User.findOne({ where: { telegram_id: telegramId } });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  user.nonce = nonce;
  await user.save();

  sendTelegramMessage(telegramId, `Kode konfirmasi withdraw Anda: ${nonce}`);

  res.json({ message: 'Kode konfirmasi dikirim ke Telegram Anda.' });
});

app.post('/withdraw', checkNonce, async (req, res) => {
  const { telegramId, wallet } = req.body;

  const result = await sendWithdrawTransaction(wallet);

  res.json({ message: 'Withdraw berhasil dikirim!', result });
});
