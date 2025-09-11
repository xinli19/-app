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
- 请求体示例：
  {
    "recipient": "aaaa1111-bbbb-2222-cccc-333333333333",
    "sender": "11111111-2222-3333-4444-555555555555",
    "type": "system_info",
    "title": "回访提醒",
    "message": "您有新的回访记录待查看",
    "link_type": "followup_record",
    "link_id": 12345
  }

4) 更新 Update
- PUT/PATCH /api/notifications/notifications/{id}/

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
