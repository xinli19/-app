总览
- 基础路径：
  - 公告 API 前缀：/api/announcements/
  - 回访 API 前缀：/api/followups/
  - 通知 API 前缀：/api/notifications/
- 统一路由文件：<mcfile name="urls.py" path="course_system/urls.py"></mcfile>
- 约定
  - Content-Type: application/json
  - 时间格式：ISO8601（UTC），如 2025-09-11T10:00:00Z
  - 主键类型：UUID
  - 分页：默认 PageNumberPagination，使用 query 参数 page；page_size 取决于 REST_FRAMEWORK 配置（如未设置，可能不分页）。配置见 <mcfile name="settings.py" path="course_system/settings.py"></mcfile>
  - 过滤：使用 DjangoFilterBackend，精确匹配，详见各端点 filterset_fields
  - 搜索：search 参数（如 ?search=xxx），匹配 search_fields
  - 排序：ordering 参数（如 ?ordering=-created_at），可用字段见 ordering_fields
  - 枚举取值：见 <mcfile name="enums.py" path="apps/core/enums.py"></mcfile>（AnnouncementType、FollowUpStatus/FollowUpPurpose/FollowUpUrgency、NotificationType、LinkType）

一、公告 Announcements
- 代码文件
  - <mcfile name="urls.py" path="apps/announcements/urls.py"></mcfile>
  - <mcfile name="views.py" path="apps/announcements/views.py"></mcfile>
  - <mcfile name="serializers.py" path="apps/announcements/serializers.py"></mcfile>

1) 列表 List
- GET /api/announcements/announcements/
- 支持
  - 过滤：type, publisher
  - 搜索：content（?search=关键字）
  - 排序：created_at, start_at, end_at（?ordering=-start_at）
  - 分页：?page=1
- 示例
  - 请求：GET /api/announcements/announcements/?type=teaching_reminder&ordering=-start_at&page=1
  - 响应 200：
    {
      "count": 1,
      "next": null,
      "previous": null,
      "results": [
        {
          "id": "c3f3b2f8-5d72-41b8-9e55-1b3fb2c6a123",
          "publisher": "8fb2f3a1-1234-4567-89ab-0c1d2e3f4a55",
          "type": "teaching_reminder",
          "content": "本周教研提醒…",
          "start_at": "2025-09-10T00:00:00Z",
          "end_at": null,
          "created_at": "2025-09-10T01:00:00Z",
          "updated_at": "2025-09-10T01:00:00Z",
          "deleted_at": null,
          "created_by": null,
          "updated_by": null
        }
      ]
    }

2) 详情 Retrieve
- GET /api/announcements/announcements/{id}/

3) 新建 Create
- POST /api/announcements/announcements/
- 请求体示例：
  {
    "publisher": "8fb2f3a1-1234-4567-89ab-0c1d2e3f4a55",
    "type": "injury_notice",
    "content": "注意近期受伤防护事项…",
    "start_at": "2025-09-12T00:00:00Z",
    "end_at": null
  }
- 响应 201：返回完整对象

4) 更新 Update
- PUT/PATCH /api/announcements/announcements/{id}/

5) 删除 Delete
- DELETE /api/announcements/announcements/{id}/
- 说明：模型继承 AuditModel（软删），deleted_at 会被设置

6) 有效公告列表
- GET /api/announcements/announcements/active/
- 说明：返回当前时间点有效的公告（位于 [start_at, end_at] 内，end_at 为空视为仍有效）

二、回访 FollowUps
- 代码文件
  - <mcfile name="urls.py" path="apps/followups/urls.py"></mcfile>
  - <mcfile name="views.py" path="apps/followups/views.py"></mcfile>
  - <mcfile name="serializers.py" path="apps/followups/serializers.py"></mcfile>

1) 列表 List
- GET /api/followups/followups/
- 支持
  - 过滤：student, operator, status, urgency, need_follow_up
  - 搜索：content, result
  - 排序：created_at, next_follow_up_at
  - 分页：?page=1
- 示例
  - 请求：GET /api/followups/followups/?student=11111111-2222-3333-4444-555555555555&need_follow_up=true&ordering=next_follow_up_at
  - 响应 200（分页结构同上）：

2) 详情 Retrieve
- GET /api/followups/followups/{id}/

3) 新建 Create
- POST /api/followups/followups/
- 字段说明
  - student(UUID) 必填
  - operator(UUID) 必填
  - content 文本 必填
  - seq_no 可选；不传则对同一 student 自动生成自增序号
  - status、purpose、urgency：枚举，若不传使用默认值
  - need_follow_up(bool) 可选；next_follow_up_at(datetime) 可选
- 请求体示例：
  {
    "student": "11111111-2222-3333-4444-555555555555",
    "operator": "aaaa1111-bbbb-2222-cccc-333333333333",
    "content": "开学前回访确认进度与安排",
    "need_follow_up": true,
    "next_follow_up_at": "2025-09-15T10:00:00Z",
    "status": "pending",
    "purpose": "regular",
    "urgency": "medium"
  }

4) 更新 Update
- PUT/PATCH /api/followups/followups/{id}/

5) 删除 Delete
- DELETE /api/followups/followups/{id}/
- 说明：软删

6) 工作流：标记完成
- POST /api/followups/followups/{id}/mark_done/
- 说明：将 status 设置为 DONE，返回最新对象

三、通知 Notifications
- 代码文件
  - <mcfile name="urls.py" path="apps/notifications/urls.py"></mcfile>
  - <mcfile name="views.py" path="apps/notifications/views.py"></mcfile>
  - <mcfile name="serializers.py" path="apps/notifications/serializers.py"></mcfile>

1) 列表 List
- GET /api/notifications/notifications/
- 支持
  - 过滤：recipient, is_read, type, link_type
  - 搜索：title, message
  - 排序：created_at, read_at
  - 分页：?page=1
- 示例
  - 请求：GET /api/notifications/notifications/?recipient=aaaa1111-bbbb-2222-cccc-333333333333&is_read=false&ordering=-created_at

2) 详情 Retrieve
- GET /api/notifications/notifications/{id}/

3) 新建 Create
- POST /api/notifications/notifications/
- 字段说明
  - recipient(UUID) 必填
  - sender(UUID) 可选
  - type 枚举 必填
  - title 可选
  - message 必填
  - link_type 与 link_id 必须同时为空或同时有值（约束 ck_notif_link_pair_coherence）

4) 更新 Update
- PUT/PATCH /api/notifications/notifications/{id}/

5) 删除 Delete
- DELETE /api/notifications/notifications/{id}/
- 说明：软删

6) 工作流：标记已读
- POST /api/notifications/notifications/{id}/mark_read/
- 说明：将 is_read=true，read_at=当前时间，返回最新对象

四、提醒 Reminders
- 代码文件
  - <mcfile name="urls.py" path="apps/reminders/urls.py"></mcfile>
  - <mcfile name="views.py" path="apps/reminders/views.py"></mcfile>
  - <mcfile name="serializers.py" path="apps/reminders/serializers.py"></mcfile>
- 前缀：/api/v1/reminders

1) 列表 List
- GET /api/v1/reminders/
- 支持
  - 过滤：category, urgency, sender, receiver, student, e2e_type
  - 搜索：content, student__nickname, student__xiaoetong_id, sender__name
  - 排序：created_at, start_at, end_at, urgency
  - 分页：?page=1&size=20（最大 size=100，若未显式声明则以全局/类分页配置为准）
- 说明：当前实现包含权限校验（详情/删除时仅允许特定用户），后续可按业务补充“仅展示生效中”等高级过滤

2) 详情 Retrieve
- GET /api/v1/reminders/{id}/
- 权限：仅 sender 或在 recipients 列表中的当前用户可查看

3) 新建 Create
- POST /api/v1/reminders/

4) 更新 Update
- PUT/PATCH /api/v1/reminders/{id}/

5) 删除 Delete
- DELETE /api/v1/reminders/{id}/
- 权限：仅 sender 可删除

6) 动作 Actions
- 标记单条为已读（别名1）
  - POST /api/v1/reminders/{id}/mark_read
  - 返回：{ "detail": "ok" }
- 标记单条为已读（别名2）
  - POST /api/v1/reminders/{id}/read
  - 返回：{ "id": "<reminder_id>", "read_at": "<ISO8601>" }
- 批量已读
  - POST /api/v1/reminders/read-bulk
  - Body: { "ids": ["<reminder_id>", ...] }
  - 返回：{ "updated": <number> }

5) 删除 Delete
- DELETE /api/notifications/notifications/{id}/
- 说明：软删

6) 工作流：标记已读
- POST /api/notifications/notifications/{id}/mark_read/
- 说明：将 is_read=true，read_at=当前时间，返回最新对象

错误响应示例
- 校验失败（400）
  {
    "link_type": ["此字段与 link_id 必须同时提供或同时为空。"]
  }
- 未找到（404）
  {
    "detail": "未找到。"
  }
- 方法不允许（405）
  {
    "detail": "方法 “PUT” 不被允许。"
  }

补充说明
- 枚举所有合法值请查看 <mcfile name="enums.py" path="apps/core/enums.py"></mcfile>，例如：
  - Announcement.type: AnnouncementType 枚举
  - FollowUpRecord.status/purpose/urgency: FollowUpStatus/FollowUpPurpose/FollowUpUrgency
  - Notification.type/link_type: NotificationType/LinkType
- 审计字段 created_by/updated_by 当前通过序列化器暴露；如果你希望由后端根据登录用户自动注入，我可以补一个权限/认证中间层或在 ViewSet 的 perform_create/perform_update 中自动设置。

五、点评 Evaluations
- 代码文件
  - <mcfile name="urls_v1.py" path="apps/evaluations/urls_v1.py"></mcfile>
  - <mcfile name="views.py" path="apps/evaluations/views.py"></mcfile>
  - <mcfile name="serializers.py" path="apps/evaluations/serializers.py"></mcfile>
- 前缀（v1）：/api/v1/...

A) 点评记录 Feedbacks
1) 列表 List
- GET /api/v1/feedbacks/
- 支持
  - 时间范围：start, end（或兼容 start_at, end_at）
    - 接受日期（YYYY-MM-DD）或日期时间（ISO8601）
    - 若均不传，默认查询最近 15 天（[now-15d, now]）
  - 关键词 q：匹配 student.nickname、teacher.name、teacher_content
  - 教师筛选：teacher_me=1/true（当前登录教师）、或 teacher_id
  - 学员筛选：student_id（UUID，非法 UUID 返回 400）
  - 课程/曲目筛选：course_id、piece_id（通过关联明细联动，内部去重）
  - 排序：created_at, updated_at；默认 -created_at
  - 分页：?page=1&size=20（最大 size=100）
- 错误示例（非法 UUID）
  - 响应 400：
    {
      "student_id": "Invalid UUID format"
    }

2) 详情 Retrieve
- GET /api/v1/feedbacks/{id}/

3) 新建 Create
- POST /api/v1/feedbacks/

4) 更新 Update
- PUT/PATCH /api/v1/feedbacks/{id}/

5) 删除 Delete
- DELETE /api/v1/feedbacks/{id}/

6) 动作 Actions
- 从点评创建提醒（占位）
  - POST /api/v1/feedbacks/{id}/create_reminder
  - 当前返回 501（占位）

7) 导出 Export
- 教研侧导出（占位）
  - GET /api/v1/feedbacks/export
- 运营侧导出（占位）
  - POST /api/v1/ops/feedbacks/export

B) 点评任务 Tasks
1) 列表 List
- GET /api/v1/tasks/
- 支持
  - 过滤：student, assignee, status, source, batch_id
  - 自定义：assignee_me=1/true（按当前登录人员）、assignee_id
  - 搜索：student__nickname, assignee__name（?search=关键字）
  - 排序：created_at, updated_at；默认 -created_at

2) 详情/CRUD
- 标准 REST：/api/v1/tasks/{id}/ GET/POST/PATCH/DELETE

3) 动作（占位）
- POST /api/v1/tasks/{id}/start
- POST /api/v1/tasks/{id}/submit
- 均返回 501（占位说明）

备注
- /api/v1/eval-tasks/ 为 /api/v1/tasks/ 的别名路由，行为一致

六、学员 Students
- 代码文件
  - <mcfile name="urls_v1.py" path="apps/students/urls_v1.py"></mcfile>
  - <mcfile name="views.py" path="apps/students/views.py"></mcfile>
  - <mcfile name="serializers.py" path="apps/students/serializers.py"></mcfile>
- 前缀（v1）：/api/v1/...

A) 学员
1) 列表 List
- GET /api/v1/students/
- 支持
  - 过滤：status, tags
  - 搜索：nickname, xiaoetong_id, remark_name（?search=关键字）
  - 排序：created_at, nickname；默认 -created_at

2) 详情/CRUD
- 标准 REST：/api/v1/students/{id}/

3) 自定义动作
- 最近历史点评（默认 10 条，?limit=1..50）
  - GET /api/v1/students/{id}/recent_feedbacks
- 从学员弹窗创建提醒（占位）
  - POST /api/v1/students/{id}/create-reminder（返回 501）

B) 学员标签
- /api/v1/student-tags/ 标准 REST

C) 学员课程记录 Course Records
- 资源：/api/v1/course-records/
- 支持
  - 过滤：student, course, course_version, course_status, record_status
  - 搜索：student__nickname, student__xiaoetong_id, course__name
  - 排序：start_at, created_at；默认 -start_at, -created_at

D) 学员导入/导出（占位）
- 预览：POST /api/v1/students/import/preview
- 提交：POST /api/v1/students/import/commit
- 批次详情：GET /api/v1/students/import/batches/{batch_id}
- 导出（运营）：POST /api/v1/ops/students/export

七、课程 Courses
- 代码文件
  - <mcfile name="urls.py" path="apps/courses/urls.py"></mcfile>
  - <mcfile name="views.py" path="apps/courses/views.py"></mcfile>
  - <mcfile name="serializers.py" path="apps/courses/serializers.py"></mcfile>
- 注意：课程模块当前前缀为 /api/courses/（非 v1）

A) 课程 Course
- 资源：/api/courses/
- 支持
  - 过滤：status
  - 搜索：name, description
  - 排序：name, created_at；默认 name
- 子资源
  - 课程下课列表：GET /api/courses/{id}/lessons
  - 课程下曲目列表：GET /api/courses/{id}/pieces

B) 课 Lesson
- 资源：/api/courses/lessons
- 支持：按模型与序列化器定义（后续可补充过滤/搜索/排序字段说明）

C) 曲目 Piece
- 资源：/api/courses/pieces
- 支持：按模型与序列化器定义（后续可补充过滤/搜索/排序字段说明）

通用错误响应示例
- 校验失败（400）
  {
    "field": ["错误信息"]
  }
- 未找到（404）
  {
    "detail": "未找到。"
  }
- 方法不允许（405）
  {
    "detail": "方法 “PUT” 不被允许。"
  }
- 非法 UUID（Feedback 列表 student_id）
  {
    "student_id": "Invalid UUID format"
  }
