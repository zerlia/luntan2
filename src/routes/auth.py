from flask import Blueprint, request, jsonify, session
from src.models.user import db, User, InviteCode

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        invite_code = data.get('inviteCode', '').strip()

        # 驗證輸入
        if not username or not password or not invite_code:
            return jsonify({'error': '請填寫完整的註冊信息'}), 400

        if len(username) < 2 or len(username) > 50:
            return jsonify({'error': '用戶名長度應在2-50個字符之間'}), 400

        if len(password) < 6:
            return jsonify({'error': '密碼長度至少6個字符'}), 400

        # 檢查用戶名是否已存在
        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用戶名已存在'}), 400

        # 檢查邀請碼是否有效且未被使用
        invite = InviteCode.query.filter_by(code=invite_code).first()
        if not invite:
            return jsonify({'error': '邀請碼無效，請聯繫獲取新的邀請碼'}), 400
        
        if invite.is_used:
            return jsonify({'error': '該邀請碼已被註冊，請聯繫獲取新的邀請碼'}), 400

        # 創建新用戶
        user = User(username=username, invite_code=invite_code)
        user.set_password(password)
        
        db.session.add(user)
        db.session.flush() # 獲取user.id，但不提交事務

        # 標記邀請碼為已使用
        invite.is_used = True
        invite.used_by_user_id = user.id

        db.session.commit()

        # 設置會話
        session['user_id'] = user.id
        session['username'] = user.username

        return jsonify({
            'message': '註冊成功',
            'user': user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'註冊失敗: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()

        if not username or not password:
            return jsonify({'error': '請填寫用戶名和密碼'}), 400

        # 查找用戶
        user = User.query.filter_by(username=username).first()
        if not user or not user.check_password(password):
            return jsonify({'error': '用戶名或密碼錯誤'}), 401

        # 設置會話
        session['user_id'] = user.id
        session['username'] = user.username

        return jsonify({
            'message': '登錄成功',
            'user': user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': f'登錄失敗: {str(e)}'}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': '已退出登錄'}), 200

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登錄'}), 401

    user = User.query.get(user_id)
    if not user:
        session.clear()
        return jsonify({'error': '用戶不存在'}), 401

    return jsonify({'user': user.to_dict()}), 200

def require_auth(f):
    """裝飾器：要求用戶登錄"""
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': '請先登錄'}), 401
        
        user = User.query.get(user_id)
        if not user:
            session.clear()
            return jsonify({'error': '用戶不存在'}), 401
        
        # 將當前用戶添加到請求上下文
        request.current_user = user
        return f(*args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function

