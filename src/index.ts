import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import { HTTPException } from 'hono/http-exception';
import { User, Post, Comment, InviteCode, AdminAccount } from './models';
import { initDb, seedData } from './db';
import { authRoutes } from './routes/auth';
import { postRoutes } from './routes/posts';
import { commentRoutes } from './routes/comments';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS Middleware
app.use('*', async (c, next) => {
  const corsOrigin = c.env.CORS_ORIGIN || '*';
  const corsMiddleware = cors({
    origin: corsOrigin.split(',').map(origin => origin.trim()),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Global Error Handler
app.onError((err, c) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method
  });
  
  if (err instanceof HTTPException) {
    // 確保返回JSON格式的錯誤響應
    return c.json({ 
      error: err.message || 'HTTP Exception',
      status: err.status 
    }, err.status);
  }
  
  return c.json({ 
    error: 'Internal Server Error',
    details: c.env.ENVIRONMENT === 'development' ? err.message : undefined
  }, 500);
});

// Auth Middleware
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth')) {
    return next();
  }
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decodedPayload = await verify(token, c.env.JWT_SECRET || 'default-secret');
    c.set('user', decodedPayload);
    await next();
  } catch (e) {
    if (e instanceof HTTPException) {
      throw e;
    }
    throw new HTTPException(401, { message: 'Unauthorized: Invalid token' });
  }
});

// Initialize DB and Seed Data on first request (or when DB is empty)


// Routes
app.route('/api/auth', authRoutes);
app.route('/api/posts', postRoutes);
app.route('/api/comments', commentRoutes);

// Fallback for root path
app.get('/', (c) => {
  return c.text('Cloudflare Forum Worker API is running!');
});

export default app;




