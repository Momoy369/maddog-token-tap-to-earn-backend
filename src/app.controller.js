import express from 'express';
import { sendSolanaToken } from './sendToken.js';

const app = express();
app.use(express.json());

const MINIMUM_POINTS = 500; // Contoh batas minimum

const COOLDOWN_HOURS = 24; // Waktu cooldown dalam jam

app.post('/api/claim-token', async (req, res) => {
  const { wallet, points } = req.body;

  if (!wallet || !points) {
    return res.status(400).json({ error: 'Wallet dan poin harus diisi!' });
  }

  // Cek apakah poin memenuhi syarat withdraw
  if (points < MINIMUM_POINTS) {
    return res
      .status(400)
      .json({ error: `Minimum withdraw adalah ${MINIMUM_POINTS} poin!` });
  }

  // Cek cooldown
  const user = await getUser(wallet);
  if (user?.lastWithdraw) {
    const lastWithdrawTime = new Date(user.lastWithdraw);
    const now = new Date();
    const diffHours = (now - lastWithdrawTime) / (1000 * 60 * 60);

    if (diffHours < COOLDOWN_HOURS) {
      return res.status(400).json({
        error: `Harap tunggu ${Math.ceil(COOLDOWN_HOURS - diffHours)} jam sebelum withdraw berikutnya!`,
      });
    }
  }

  try {
    const tokenAmount = points / 100;
    const txHash = await sendSolanaToken(wallet, tokenAmount);

    // Perbarui waktu withdraw terakhir
    await updateUserWithdrawTime(wallet);

    return res.json({ success: true, txHash });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal mengirim token!' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`),
);
