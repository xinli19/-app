# 课程管理系统（Django + 前端静态页）
- 创建虚拟环境（如未创建）
  ``python3 -m venv .venv``

- 激活虚拟环境（macOS）
    ``source .venv/bin/activate``
- 安装依赖
    ``pip install -r requirements.txt``

- 迁移数据库    
    ``python manage.py migrate``

- 创建超级用户（可登录 Django Admin）
    ``python manage.py createsuperuser``

- 启动后端
    ``python manage.py runserver 8000``

- 启动前端静态服务器（另开终端，在 frontend 目录）
    ``python3 -m http.server 8080``

打开浏览器：
- 后端接口调试：http://127.0.0.1:8000/
- 前端登录页：http://127.0.0.1:8080/index.html

## 系统用户账户信息
== 系统用户账户信息 ===
李老师 - 用户名: 李老师_teacher - 密码: 123456
黄老师 - 用户名: 黄老师_teacher - 密码: 123456
王老师 - 用户名: 王老师_teacher - 密码: 123456
钟老师 - 用户名: 钟老师_teacher - 密码: 123456
王老师 - 用户名: 王老师_researcher - 密码: 123456
杜老师 - 用户名: 杜老师_operator - 密码: 123456