from flask import Blueprint, request, jsonify
from src.models.user import db, Comment, CommentLike
from src.routes.auth import require_auth

comments_bp = Blueprint('comments', __name__)

@comments_bp.route('/comments/<int:comment_id>/like', methods=['POST'])
@require_auth
def toggle_comment_like(comment_id):
    try:
        comment = Comment.query.get_or_404(comment_id)
        user_id = request.current_user.id

        # 檢查是否已經點讚
        existing_like = CommentLike.query.filter_by(comment_id=comment_id, user_id=user_id).first()

        if existing_like:
            # 取消點讚
            db.session.delete(existing_like)
            comment.likes_count = max(0, comment.likes_count - 1)
            action = 'unliked'
        else:
            # 添加點讚
            like = CommentLike(comment_id=comment_id, user_id=user_id)
            db.session.add(like)
            comment.likes_count += 1
            action = 'liked'

        db.session.commit()

        return jsonify({
            'message': f'評論{action}',
            'likes_count': comment.likes_count,
            'liked': action == 'liked'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'點讚操作失敗: {str(e)}'}), 500

@comments_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@require_auth
def delete_comment(comment_id):
    try:
        comment = Comment.query.get_or_404(comment_id)
        
        # 檢查是否是評論作者
        if comment.user_id != request.current_user.id:
            return jsonify({'error': '只能刪除自己的評論'}), 403

        # 更新帖子的評論數
        post = comment.post
        post.comments_count = max(0, post.comments_count - 1)

        db.session.delete(comment)
        db.session.commit()

        return jsonify({'message': '評論已刪除'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'刪除評論失敗: {str(e)}'}), 500

