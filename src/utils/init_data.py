import random
import string
from src.models.user import db, InviteCode, User, Post, Comment

def generate_invite_codes(count=10000):
    """生成邀請碼"""
    codes = set()
    while len(codes) < count:
        # 生成8位隨機字符串
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        codes.add(code)
    
    return list(codes)

def init_invite_codes():
    """初始化邀請碼到數據庫"""
    try:
        # 檢查是否已經有邀請碼
        existing_count = InviteCode.query.count()
        if existing_count > 0:
            print(f"數據庫中已有 {existing_count} 個邀請碼")
            return

        print("正在生成10000個邀請碼...")
        codes = generate_invite_codes(10000)
        
        print("正在保存到數據庫...")
        for code in codes:
            invite_code = InviteCode(code=code)
            db.session.add(invite_code)
        
        db.session.commit()
        print(f"成功生成並保存了 {len(codes)} 個邀請碼")
        
        # 顯示前10個邀請碼作為示例
        print("前10個邀請碼示例:")
        for i, code in enumerate(codes[:10]):
            print(f"  {i+1}. {code}")

    except Exception as e:
        db.session.rollback()
        print(f"初始化邀請碼失敗: {str(e)}")

def init_sample_data():
    """初始化示例數據"""
    try:
        # 檢查是否已有用戶
        if User.query.count() > 0:
            print("數據庫中已有用戶數據")
            return

        # 創建示例用戶（需要先有邀請碼）
        invite_codes = InviteCode.query.filter_by(is_used=False).limit(5).all()
        if len(invite_codes) < 5:
            print("邀請碼不足，請先初始化邀請碼")
            return

        users_data = [
            {'username': 'admin', 'password': 'admin123'},
            {'username': 'moderator', 'password': 'mod123'},
            {'username': 'developer', 'password': 'dev123'},
            {'username': 'user1', 'password': 'user123'},
            {'username': 'user2', 'password': 'user123'}
        ]

        users = []
        for i, user_data in enumerate(users_data):
            invite_code = invite_codes[i]
            user = User(
                username=user_data['username'],
                invite_code=invite_code.code
            )
            user.set_password(user_data['password'])
            
            invite_code.is_used = True
            invite_code.used_by_user_id = user.id
            
            db.session.add(user)
            users.append(user)

        db.session.commit()

        # 更新邀請碼的used_by_user_id
        for i, user in enumerate(users):
            invite_codes[i].used_by_user_id = user.id
        
        db.session.commit()

        # 創建示例帖子
        posts_data = [
            {
                'title': '歡迎來到我們的論壇！',
                'content': '這是第一個帖子，歡迎大家積極參與討論。',
                'author': users[0]  # admin
            },
            {
                'title': '關於論壇使用規則的說明',
                'content': '請大家遵守論壇規則，文明發言，共同維護良好的討論環境。',
                'author': users[1]  # moderator
            },
            {
                'title': '技術討論：Cloudflare Workers的最佳實踐',
                'content': '分享一些使用Cloudflare Workers開發的經驗和技巧。',
                'author': users[2]  # developer
            }
        ]

        posts = []
        for post_data in posts_data:
            post = Post(
                title=post_data['title'],
                content=post_data['content'],
                user_id=post_data['author'].id
            )
            db.session.add(post)
            posts.append(post)

        db.session.commit()

        # 創建示例評論
        comments_data = [
            {'content': '很好的帖子，感謝分享！', 'post': posts[0], 'author': users[3]},
            {'content': '我也有同樣的想法，期待更多討論。', 'post': posts[0], 'author': users[4]},
            {'content': '這個觀點很有意思，能詳細說說嗎？', 'post': posts[2], 'author': users[3]},
        ]

        for comment_data in comments_data:
            comment = Comment(
                content=comment_data['content'],
                post_id=comment_data['post'].id,
                user_id=comment_data['author'].id
            )
            db.session.add(comment)
            
            # 更新帖子評論數
            comment_data['post'].comments_count += 1

        db.session.commit()
        print("示例數據初始化完成")

    except Exception as e:
        db.session.rollback()
        print(f"初始化示例數據失敗: {str(e)}")

def init_all_data():
    """初始化所有數據"""
    print("開始初始化數據...")
    init_invite_codes()
    init_sample_data()
    print("數據初始化完成！")

