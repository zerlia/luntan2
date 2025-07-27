export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  user_id: number;
  username: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  last_modified_at: string;
}

export interface Comment {
  id: number;
  content: string;
  post_id: number;
  user_id: number;
  username: string;
  likes_count: number;
  created_at: string;
}

export interface PostLike {
  id: number;
  post_id: number;
  user_id: number;
  created_at: string;
}

export interface CommentLike {
  id: number;
  comment_id: number;
  user_id: number;
  created_at: string;
}

export interface InviteCode {
  id: number;
  code: string;
  is_used: boolean;
  used_by_user_id?: number;
  created_at: string;
  used_at?: string;
}

export interface AdminAccount {
  id: number;
  username: string;
  password: string;
  created_at: string;
}

