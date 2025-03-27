import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './database.js';

const router = express.Router();
const SECRET_KEY = '8147895010:AAFae3317MytJ7yjdq9LNAljip5ohekzEIw';

router.post('/register', async (req, res) => {
  const { initData } = req.body;

  try {
    const verified = verifyTelegramAuth(initData);
    if (!verified) {
      return res.status(403).json({ error: 'Invalid authentication' });
    }

    const userId = verified.user.id;
    const username = verified.user.username || 'Unknown';

    const query = `
            INSERT INTO users (telegram_id, username) 
            VALUES ($1, $2) 
            ON CONFLICT (telegram_id) DO NOTHING
            RETURNING *;
        `;
    const { rows } = await pool.query(query, [userId, username]);

    const token = jwt.sign({ userId, username }, SECRET_KEY, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: rows[0] || { telegram_id: userId, username, balance: 0 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

function verifyTelegramAuth(initData) {
  const params = new URLSearchParams(initData);
  return Object.fromEntries(params.entries());
}

export default router;
