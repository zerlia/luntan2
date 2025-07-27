import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Post } from '../models';
import { requireAdmin } from './auth';

export const postRoutes = new Hono<{ Bindings: Env }>();

// Get all posts with pagination and sorting by likes
postRoutes.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const offset = (page - 1) * limit;

  const db = c.env.DB;
  const posts = await db.prepare(`
    SELECT p.*, u.username 
    FROM posts p 
    JOIN users u ON p.user_id = u.id 
    ORDER BY p.likes_count DESC, p.created_at DESC 
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return c.json({ posts: posts.results });
});

// Get a specific post
postRoutes.get('/:id', async (c) => {
  const postId = parseInt(c.req.param('id'));
  const db = c.env.DB;

  const post = await db.prepare(`
    SELECT p.*, u.username 
    FROM posts p 
    JOIN users u ON p.user_id = u.id 
    WHERE p.id = ?
  `).bind(postId).first<Post>();

  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' });
  }

  return c.json({ post });
});

// Create a new post
postRoutes.post('/', async (c) => {
  const { title, content } = await c.req.json();
  const user = c.get('user');

  if (!title || !content) {
    throw new HTTPException(400, { message: 'Title and content are required' });
  }

  const db = c.env.DB;
  const { success, results } = await db.prepare(
    'INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)'
  ).bind(title, content, user.id).run();

  if (!success) {
    throw new HTTPException(500, { message: 'Failed to create post' });
  }

  return c.json({ message: 'Post created successfully', postId: results.lastInsertRowId }, 201);
});

// Update a post (only by the author)
postRoutes.put('/:id', async (c) => {
  const postId = parseInt(c.req.param('id'));
  const { title, content } = await c.req.json();
  const user = c.get('user');

  if (!title || !content) {
    throw new HTTPException(400, { message: 'Title and content are required' });
  }

  const db = c.env.DB;
  const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first();

  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' });
  }

  if (post.user_id !== user.id) {
    throw new HTTPException(403, { message: 'You can only edit your own posts' });
  }

  const { success } = await db.prepare(
    'UPDATE posts SET title = ?, content = ?, last_modified_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(title, content, postId).run();

  if (!success) {
    throw new HTTPException(500, { message: 'Failed to update post' });
  }

  const updatedPost = await db.prepare(`
    SELECT p.*, u.username 
    FROM posts p 
    JOIN users u ON p.user_id = u.id 
    WHERE p.id = ?
  `).bind(postId).first<Post>();

  return c.json({ message: 'Post updated successfully', post: updatedPost });
});

// Delete a post (admin only)
postRoutes.delete('/:id', requireAdmin, async (c) => {
  const postId = parseInt(c.req.param('id'));
  const db = c.env.DB;

  const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first();

  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' });
  }

  // Delete related comments and likes first
  await db.prepare('DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)').bind(postId).run();
  await db.prepare('DELETE FROM comments WHERE post_id = ?').bind(postId).run();
  await db.prepare('DELETE FROM post_likes WHERE post_id = ?').bind(postId).run();
  
  const { success } = await db.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();

  if (!success) {
    throw new HTTPException(500, { message: 'Failed to delete post' });
  }

  return c.json({ message: 'Post deleted successfully' });
});

// Like/unlike a post
postRoutes.post('/:id/like', async (c) => {
  const postId = parseInt(c.req.param('id'));
  const user = c.get('user');
  const db = c.env.DB;

  const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first();
  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' });
  }

  const existingLike = await db.prepare('SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?')
    .bind(postId, user.id).first();

  if (existingLike) {
    // Unlike
    await db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').bind(postId, user.id).run();
    await db.prepare('UPDATE posts SET likes_count = likes_count - 1 WHERE id = ?').bind(postId).run();
    return c.json({ message: 'Post unliked', liked: false });
  } else {
    // Like
    await db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').bind(postId, user.id).run();
    await db.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').bind(postId).run();
    return c.json({ message: 'Post liked', liked: true });
  }
});

// Get comments for a post
postRoutes.get('/:id/comments', async (c) => {
  const postId = parseInt(c.req.param('id'));
  const db = c.env.DB;

  const comments = await db.prepare(`
    SELECT c.*, u.username 
    FROM comments c 
    JOIN users u ON c.user_id = u.id 
    WHERE c.post_id = ? 
    ORDER BY c.likes_count DESC, c.created_at ASC
  `).bind(postId).all();

  return c.json({ comments: comments.results });
});

// Add a comment to a post
postRoutes.post('/:id/comments', async (c) => {
  const postId = parseInt(c.req.param('id'));
  const { content } = await c.req.json();
  const user = c.get('user');

  if (!content) {
    throw new HTTPException(400, { message: 'Content is required' });
  }

  const db = c.env.DB;
  const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first();
  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' });
  }

  const { success } = await db.prepare(
    'INSERT INTO comments (content, post_id, user_id) VALUES (?, ?, ?)'
  ).bind(content, postId, user.id).run();

  if (!success) {
    throw new HTTPException(500, { message: 'Failed to create comment' });
  }

  // Update post comment count
  await db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').bind(postId).run();

  return c.json({ message: 'Comment created successfully' }, 201);
});



