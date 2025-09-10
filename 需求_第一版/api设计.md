# 一、端口与访问入口

- 开发环境端口（建议默认）
  - 前端（Dev/SPA）：5173
  - 后端（API）：8000

- 开发环境访问入口
  - API 基础路径（开发）：http://localhost:8000/api/v1
  - 前端根（开发）：http://localhost:5173
    - 教师模块入口样例：http://localhost:5173/t/announcements/
    - 教研模块入口样例：http://localhost:5173/r/feedbacks
    - 运营模块入口样例：http://localhost:5173/o/reminders
  - 说明：上述为样例入口，更多路由见“二、Views URL”章节

- 环境变量约定（建议写入 .env/.env.example）
  - FRONTEND_PORT=5173
  - BACKEND_PORT=8000
  - VITE_API_BASE_URL=http://localhost:8000/api/v1

- 本地联调建议
  - 前端 devServer 代理：将 /api → http://localhost:8000 以避免 CORS
  - 后端 CORS：允许 http://localhost:5173（或对应前端域名）

- 生产环境占位（按部署实际替换）
  - API_BASE_URL=https://api.example.com/api/v1
  - 前端域名：https://app.example.com

- 可选
  - 生成“路由索引页”，聚合常用 views URL 以便联调、验收与跳转

二、Views URL（按模块，基于现有 Mermaid 流程图中明确写出的前端路由）

- 教师模块（/t/...）
  
  - /t/announcements/（公告列表）
  - /t/reminders/（提醒列表 + 批量/单条已读在此页操作）
  - /t/evaluation-tasks/（点评任务列表）
  - /t/evaluation-tasks/:id/（任务详情）
  - /t/feedbacks/（点评历史总览）
  - 说明：学员信息与历史弹窗为页面内弹窗，不是独立路由
- 教研模块（/r/...）
  
  - /r/announcements/new（发布公告）
  - /r/announcements/:id/edit（编辑公告）
  - /r/feedbacks（点评列表）
  - /r/feedbacks/:id（点评详情）
  - /r/evaluation-tasks/new-batch（创建点评任务批次）
  - /r/evaluation-tasks（任务列表）
  - /r/downloads（下载中心）
  - /r/workloads（工作量统计）
  - 说明：学员信息与历史弹窗为页面内弹窗；从弹窗“查看全部”会跳往 /r/feedbacks?student_id=:id（深链）
- 运营模块（/o/...）
  
  - /o/reminders（提醒事项展示）
  - /o/feedbacks（学员点评记录列表）
  - /o/students/import（学员导入页）
  - /o/students/new（手动新增学员）
  - /o/students?search（学员检索入口）
  - /o/students（学员列表，用于导出勾选等）
  - /o/reminders/new（新建提醒；也可从学员弹窗跳入并携带 student_id）
  - /o/reminders/all（提醒事项管理-查看全部）
  - /o/visit-records（回访记录列表）
  - /o/visit-records/:id/edit（编辑回访记录）
  - /o/visit-records/new（新建回访记录）
  - 说明：学员信息与历史弹窗为页面内弹窗，不是独立路由
补充说明

- API 基础路径在图中均以 /api/v1/... 表示，但你这次只问端口与 views URL，我未在此展开 API 列表
- 若你确认端口号，我可以：
  - 在文档中补充“端口与访问入口”章节
  - 生成或更新 .env.example/.env、启动脚本（前后端）与 README 中的访问说明
  - 可选：为上述 views URL 生成一个索引页（路由清单）便于联调与验收