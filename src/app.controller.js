import express from 'express';
import { sendSolanaToken } from './sendToken.js';

const app = express();
app.use(express.json());

const MINIMUM_POINTS = 50000;

const COOLDOWN_HOURS = 24;

app.post('/user/claim-token', async (req, res) => {
  const { wallet, points } = req.body;

  if (!wallet || !points) {
    return res.status(400).json({ error: 'Wallet dan poin harus diisi!' });
  }

  if (points < MINIMUM_POINTS) {
    return res
      .status(400)
      .json({ error: `Minimum withdraw adalah ${MINIMUM_POINTS} poin!` });
  }

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

    await updateUserWithdrawTime(wallet);

    return res.json({ success: true, txHash });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal mengirim token!' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server berjalan di https://maddog-token.site:${PORT}`),
);
