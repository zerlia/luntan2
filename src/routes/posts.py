from flask import Blueprint, request, jsonify
from sqlalchemy import desc
from src.models.user import db, Post, PostLike, Comment
from src.routes.auth import require_auth

posts_bp = Blueprint('posts', __name__)

@posts_bp.route('/posts', methods=['GET'])
@require_auth
def get_posts():
    try:
        # 獲取所有帖子，按點讚數降序，然後按創建時間降序排序
        posts = Post.query.order_by(desc(Post.likes_count), desc(Post.created_at)).all()
        
        current_user_id = request.current_user.id
        posts_data = [post.to_dict(current_user_id) for post in posts]
        
        return jsonify({'posts': posts_data}), 200

    except Exception as e:
        return jsonify({'error': f'獲取帖子失敗: {str(e)}'}), 500

@posts_bp.route('/posts', methods=['POST'])
@require_auth
def create_post():
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()

        if not title or not content:
            return jsonify({'error': '請填寫帖子標題和內容'}), 400

        if len(title) > 200:
            return jsonify({'error': '標題不能超過200個字符'}), 400

        if len(content) > 10000:
            return jsonify({'error': '內容不能超過10000個字符'}), 400

        # 創建新帖子
        post = Post(
            title=title,
            content=content,
            user_id=request.current_user.id
        )

        db.session.add(post)
        db.session.commit()

        return jsonify({
            'message': '帖子發布成功',
            'post': post.to_dict(request.current_user.id)
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'發布帖子失敗: {str(e)}'}), 500

@posts_bp.route('/posts/<int:post_id>', methods=['GET'])
@require_auth
def get_post(post_id):
    try:
        post = Post.query.get_or_404(post_id)
        current_user_id = request.current_user.id
        
        return jsonify({'post': post.to_dict(current_user_id)}), 200

    except Exception as e:
        return jsonify({'error': f'獲取帖子失敗: {str(e)}'}), 500

@posts_bp.route('/posts/<int:post_id>/like', methods=['POST'])
@require_auth
def toggle_post_like(post_id):
    try:
        post = Post.query.get_or_404(post_id)
        user_id = request.current_user.id

        # 檢查是否已經點讚
        existing_like = PostLike.query.filter_by(post_id=post_id, user_id=user_id).first()

        if existing_like:
            # 取消點讚
            db.session.delete(existing_like)
            post.likes_count = max(0, post.likes_count - 1)
            action = 'unliked'
        else:
            # 添加點讚
            like = PostLike(post_id=post_id, user_id=user_id)
            db.session.add(like)
            post.likes_count += 1
            action = 'liked'

        db.session.commit()

        return jsonify({
            'message': f'帖子{action}',
            'likes_count': post.likes_count,
            'liked': action == 'liked'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'點讚操作失敗: {str(e)}'}), 500

@posts_bp.route('/posts/<int:post_id>/comments', methods=['GET'])
@require_auth
def get_post_comments(post_id):
    try:
        post = Post.query.get_or_404(post_id)
        
        # 獲取評論，按點讚數降序，然後按創建時間降序排序
        comments = Comment.query.filter_by(post_id=post_id).order_by(
            desc(Comment.likes_count), desc(Comment.created_at)
        ).all()
        
        current_user_id = request.current_user.id
        comments_data = [comment.to_dict(current_user_id) for comment in comments]
        
        return jsonify({'comments': comments_data}), 200

    except Exception as e:
        return jsonify({'error': f'獲取評論失敗: {str(e)}'}), 500

@posts_bp.route('/posts/<int:post_id>/comments', methods=['POST'])
@require_auth
def create_comment(post_id):
    try:
        post = Post.query.get_or_404(post_id)
        
        data = request.get_json()
        content = data.get('content', '').strip()

        if not content:
            return jsonify({'error': '請填寫評論內容'}), 400

        if len(content) > 5000:
            return jsonify({'error': '評論內容不能超過5000個字符'}), 400

        # 創建新評論
        comment = Comment(
            content=content,
            post_id=post_id,
            user_id=request.current_user.id
        )

        # 更新帖子的評論數
        post.comments_count += 1

        db.session.add(comment)
        db.session.commit()

        return jsonify({
            'message': '評論發表成功',
            'comment': comment.to_dict(request.current_user.id)
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'發表評論失敗: {str(e)}'}), 500

