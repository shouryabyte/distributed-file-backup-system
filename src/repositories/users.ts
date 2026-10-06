import { pool } from '../config/db.js';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const result = await pool.query<User>(
    'INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING *',
    [email, passwordHash],
  );
  return result.rows[0];
}
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const result = await pool.query<User>('SELECT * FROM users WHERE email=$1', [email]);
  return result.rows[0];
}
export async function findUserById(id: string): Promise<User | undefined> {
  const result = await pool.query<User>('SELECT * FROM users WHERE id=$1', [id]);
  return result.rows[0];
}
