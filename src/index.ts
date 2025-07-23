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
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN ? c.env.CORS_ORIGIN.split(',') : ['*'], // Allow multiple origins
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Global Error Handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(`${err}`);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Auth Middleware
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith("/api/auth") || c.req.path.startsWith("/api/init-db")) {
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
app.use('/api/*', async (c, next) => {
  try {
    await initDb(c.env.DB);
    // Only seed data in development or if explicitly triggered
    if (c.env.ENVIRONMENT === 'development') {
      await seedData(c.env.DB);
    }
  } catch (e) {
    console.error('Database initialization or seeding failed:', e);
    throw new HTTPException(500, { message: 'Database initialization failed' });
  }
  await next();
});

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/posts', postRoutes);
app.route('/api/comments', commentRoutes);

// Fallback for root path
app.get('/', (c) => {
  return c.text('Cloudflare Forum Worker API is running!');
});

export default app;



// Endpoint to manually trigger database initialization and seeding
app.get("/api/init-db", async (c) => {
  try {
    await initDb(c.env.DB);
    await seedData(c.env.DB);
    return c.json({ message: "Database initialized and seeded successfully!" });
  } catch (e) {
    console.error("Error initializing or seeding database:", e);
    throw new HTTPException(500, { message: "Failed to initialize or seed database." });
  }
});