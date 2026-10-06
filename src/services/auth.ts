import bcrypt from 'bcrypt';
import { AppError } from '../errors/AppError.js';
import { createUser, findUserByEmail, findUserById } from '../repositories/users.js';
import { signToken } from '../auth/jwt.js';

export async function register(email: string, password: string) {
  const hash = await bcrypt.hash(password, 12);
  try {
    const user = await createUser(email.toLowerCase(), hash);
    return { user: { id: user.id, email: user.email }, token: signToken(user.id) };
  } catch (error) {
    if ((error as { code?: string }).code === '23505')
      throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
    throw error;
  }
}
export async function login(email: string, password: string) {
  const user = await findUserByEmail(email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  return { user: { id: user.id, email: user.email }, token: signToken(user.id) };
}
export async function me(id: string) {
  const user = await findUserById(id);
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User no longer exists');
  return { id: user.id, email: user.email, createdAt: user.created_at };
}
