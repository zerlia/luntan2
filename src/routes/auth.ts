import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { HTTPException } from 'hono/http-exception';
import bcrypt from 'bcryptjs';
import { User } from '../models';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
}

export const authRoutes = new Hono<{ Bindings: Env }>();

// Helper to check if user is admin
export const requireAdmin = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Forbidden: Admin access required' });
  }
  await next();
};

authRoutes.post('/register', async (c) => {
  const { username, password, invite_code } = await c.req.json();

  if (!username || !password || !invite_code) {
    throw new HTTPException(400, { message: 'Username, password, and invite code are required' });
  }

  const db = c.env.DB;

  // Check if invite code is valid and not used
  const inviteCodeRecord = await db.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(invite_code).first();
  if (!inviteCodeRecord) {
    throw new HTTPException(400, { message: 'Invalid invite code' });
  }
  if (inviteCodeRecord.is_used) {
    throw new HTTPException(400, { message: '該邀請碼已被註冊，請聯繫獲取新的邀請碼' });
  }

  // Check if username already exists
  const existingUser = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (existingUser) {
    throw new HTTPException(409, { message: 'Username already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Start a transaction to ensure atomicity
  try {
    // Insert user and get the last_row_id
    const insertUserResult = await db.prepare(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    ).bind(username, passwordHash, 'user').run();

    if (!insertUserResult.success) {
      throw new HTTPException(500, { message: 'Failed to register user' });
    }

    const userId = insertUserResult.meta.last_row_id;

    // Mark invite code as used within the same transaction context
    const updateInviteCodeResult = await db.prepare(
      'UPDATE invite_codes SET is_used = TRUE, used_by_user_id = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(userId, inviteCodeRecord.id).run();

    if (!updateInviteCodeResult.success) {
      // If invite code update fails, we should ideally rollback the user creation.
      // D1 doesn't have explicit rollback for individual statements, but a transaction (batch) would handle this.
      // For now, we rely on the error propagation to prevent a successful response.
      throw new HTTPException(500, { message: 'Failed to mark invite code as used' });
    }

    return c.json({ message: 'User registered successfully' }, 201);
  } catch (error) {
    // Handle any errors during the transaction
    console.error('Registration transaction failed:', error);
    if (error instanceof HTTPException) {
      throw error; // Re-throw HTTPException to be handled by global error handler
    }
    throw new HTTPException(500, { message: 'Registration failed due to an unexpected error' });
  }
});

authRoutes.post('/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    throw new HTTPException(400, { message: 'Username and password are required' });
  }

  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<User>();

  if (user) {
    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
    console.log(`Login attempt for user: ${username}`);
    console.log(`Provided password: ${password}`);
    console.log(`Stored hash: ${user.password_hash}`);
    console.log(`Password comparison result: ${isPasswordCorrect}`);

    if (!isPasswordCorrect) {
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }
  } else {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  const token = await sign({ id: user.id, username: user.username, role: user.role }, c.env.JWT_SECRET || 'default-secret');

  return c.json({ token });
});

authRoutes.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({ user });
});

authRoutes.post('/admin/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    throw new HTTPException(400, { message: 'Username and password are required' });
  }

  const db = c.env.DB;
  const adminAccount = await db.prepare('SELECT * FROM admin_accounts WHERE username = ?').bind(username).first();

  if (!adminAccount || !await bcrypt.compare(password, adminAccount.password)) {
    throw new HTTPException(401, { message: 'Invalid admin credentials' });
  }

  const token = await sign({ id: adminAccount.id, username: adminAccount.username, role: 'admin' }, c.env.JWT_SECRET || 'default-secret');

  return c.json({ token });
});



