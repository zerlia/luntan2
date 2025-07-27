from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    invite_code = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 關聯關係
    posts = db.relationship('Post', backref='author', lazy=True)
    comments = db.relationship('Comment', backref='author', lazy=True)
    post_likes = db.relationship('PostLike', backref='user', lazy=True)
    comment_likes = db.relationship('CommentLike', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class InviteCode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    used_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<InviteCode {self.code}>'

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'is_used': self.is_used,
            'used_by_user_id': self.used_by_user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    likes_count = db.Column(db.Integer, default=0)
    comments_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 關聯關係
    comments = db.relationship('Comment', backref='post', lazy=True, cascade='all, delete-orphan')
    likes = db.relationship('PostLike', backref='post', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Post {self.title}>'

    def to_dict(self, current_user_id=None):
        liked_by_user = False
        if current_user_id:
            liked_by_user = any(like.user_id == current_user_id for like in self.likes)
        
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'author': self.author.username,
            'user_id': self.user_id,
            'likes_count': self.likes_count,
            'comments_count': self.comments_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'liked_by_user': liked_by_user
        }

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    likes_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 關聯關係
    likes = db.relationship('CommentLike', backref='comment', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Comment {self.id}>'

    def to_dict(self, current_user_id=None):
        liked_by_user = False
        if current_user_id:
            liked_by_user = any(like.user_id == current_user_id for like in self.likes)
        
        return {
            'id': self.id,
            'content': self.content,
            'author': self.author.username,
            'user_id': self.user_id,
            'post_id': self.post_id,
            'likes_count': self.likes_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'liked_by_user': liked_by_user
        }

class PostLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 確保每個用戶只能對每個帖子點讚一次
    __table_args__ = (db.UniqueConstraint('post_id', 'user_id', name='unique_post_like'),)

    def __repr__(self):
        return f'<PostLike post_id={self.post_id} user_id={self.user_id}>'

class CommentLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 確保每個用戶只能對每個評論點讚一次
    __table_args__ = (db.UniqueConstraint('comment_id', 'user_id', name='unique_comment_like'),)

    def __repr__(self):
        return f'<CommentLike comment_id={self.comment_id} user_id={self.user_id}>'
