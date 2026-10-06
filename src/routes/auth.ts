import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../services/auth.js';

export const authRouter = Router();
const credentials = z.object({ email: z.email(), password: z.string().min(8).max(128) });
authRouter.post('/register', async (req, res) => {
  const body = credentials.parse(req.body);
  res.status(201).json(await auth.register(body.email, body.password));
});
authRouter.post('/login', async (req, res) => {
  const body = credentials.parse(req.body);
  res.json(await auth.login(body.email, body.password));
});
authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await auth.me(req.userId!));
});
