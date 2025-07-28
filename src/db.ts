import { InviteCode, AdminAccount } from './models';

export async function initDb(db: D1Database): Promise<void> {
  if (!db) {
    throw new Error('Database binding is not available. Please check your wrangler.toml configuration.');
  }
  
  try {
    // Create tables if they don't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        likes_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS comment_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, user_id),
        FOREIGN KEY (comment_id) REFERENCES comments (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS invite_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME,
        FOREIGN KEY (used_by_user_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS admin_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

export async function seedData(db: D1Database): Promise<void> {
  if (!db) {
    throw new Error('Database binding is not available');
  }
  
  try {
    // Check if data already exists
    const existingUsers = await db.prepare('SELECT COUNT(*) as count FROM users').first();
    if (existingUsers && existingUsers.count > 0) {
      console.log('Database already seeded, skipping...');
      return; // Data already seeded
    }

    // Generate 10000 invite codes
    const inviteCodes = generateInviteCodes(10000);
    
    // Generate 10 admin accounts
    const adminAccounts = generateAdminAccounts(10);

    // Insert invite codes in batches
    const batchSize = 100;
    for (let i = 0; i < inviteCodes.length; i += batchSize) {
      const batch = inviteCodes.slice(i, i + batchSize);
      const stmt = db.prepare('INSERT INTO invite_codes (code) VALUES (?)');
      
      for (const code of batch) {
        await stmt.bind(code).run();
      }
    }

    // Insert admin accounts
    const adminStmt = db.prepare('INSERT INTO admin_accounts (username, password) VALUES (?, ?)');
    for (const admin of adminAccounts) {
      await adminStmt.bind(admin.username, admin.password).run();
    }

    console.log('Database seeded with invite codes and admin accounts');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw new Error(`Database seeding failed: ${error.message}`);
  }
}

function generateInviteCodes(count: number): string[] {
  const codes = new Set<string>();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  while (codes.size < count) {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    codes.add(code);
  }
  
  return Array.from(codes);
}

function generateAdminAccounts(count: number): AdminAccount[] {
  const accounts: AdminAccount[] = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  
  for (let i = 1; i <= count; i++) {
    let password = '';
    for (let j = 0; j < 12; j++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    accounts.push({
      id: i,
      username: `admin${i}`,
      password: password,
      created_at: new Date().toISOString()
    });
  }
  
  return accounts;
}

