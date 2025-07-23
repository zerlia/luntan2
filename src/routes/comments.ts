import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAdmin } from './auth';

export const commentRoutes = new Hono<{ Bindings: Env }>();

// Like/unlike a comment
commentRoutes.post('/:id/like', async (c) => {
  const commentId = parseInt(c.req.param('id'));
  const user = c.get('user');
  const db = c.env.DB;

  const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(commentId).first();
  if (!comment) {
    throw new HTTPException(404, { message: 'Comment not found' });
  }

  const existingLike = await db.prepare('SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?')
    .bind(commentId, user.id).first();

  if (existingLike) {
    // Unlike
    await db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').bind(commentId, user.id).run();
    await db.prepare('UPDATE comments SET likes_count = likes_count - 1 WHERE id = ?').bind(commentId).run();
    return c.json({ message: 'Comment unliked', liked: false });
  } else {
    // Like
    await db.prepare('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)').bind(commentId, user.id).run();
    await db.prepare('UPDATE comments SET likes_count = likes_count + 1 WHERE id = ?').bind(commentId).run();
    return c.json({ message: 'Comment liked', liked: true });
  }
});

// Delete a comment (admin only)
commentRoutes.delete('/:id', requireAdmin, async (c) => {
  const commentId = parseInt(c.req.param('id'));
  const db = c.env.DB;

  const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(commentId).first();
  if (!comment) {
    throw new HTTPException(404, { message: 'Comment not found' });
  }

  // Delete related likes first
  await db.prepare('DELETE FROM comment_likes WHERE comment_id = ?').bind(commentId).run();
  
  const { success } = await db.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();

  if (!success) {
    throw new HTTPException(500, { message: 'Failed to delete comment' });
  }

  // Update post comment count
  await db.prepare('UPDATE posts SET comments_count = comments_count - 1 WHERE id = ?').bind(comment.post_id).run();

  return c.json({ message: 'Comment deleted successfully' });
});

