from rest_framework import viewsets, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from django.db import transaction
import uuid
import datetime
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.db.models import Q
from django.utils.dateparse import parse_datetime, parse_date
from django.db.models import Count, Min, Max  # 新增聚合

from .models import EvaluationTask, FeedbackRecord, FeedbackPieceDetail
from .serializers import EvaluationTaskSerializer, FeedbackRecordSerializer, FeedbackPieceDetailSerializer

def resolve_person_id(user):
    """
    根据当前登录用户解析 Person：
    - 优先通过显式绑定的 OneToOne（person_profile）
    - 其次通过 email/username 匹配 Person
    - 若均不存在且已认证，则自动创建对应 Person 并绑定
    - 最后在本次请求周期内把 person_id 临时挂到 user 上，便于后续使用
    """
    pid = getattr(user, 'person_id', None)
    if pid:
        return str(pid)

    # 1) 优先用绑定关系
    try:
        linked = getattr(user, 'person_profile', None)
    except Exception:
        linked = None
    if linked:
        setattr(user, 'person_id', str(linked.id))
        return str(linked.id)

    # 2) 退回到 email/username 匹配（并顺带绑定起来）
    try:
        from apps.persons.models import Person
    except Exception:
        return None

    if not getattr(user, 'is_authenticated', False):
        return None

    person = None
    email = getattr(user, 'email', None) or None
    if email:
        person = Person.objects.filter(email=email).first()
    if not person:
        username = getattr(user, 'username', None) or None
        if username:
            person = Person.objects.filter(name=username).first()

    # 找到就绑定
    if person and not getattr(person, 'user_id', None):
        person.user = user
        try:
            person.save(update_fields=['user'])
        except Exception:
            pass

    # 3) 还没有就创建并绑定（可按需要改为“不创建，只报错”）
    if not person:
        username = getattr(user, 'username', None) or '未命名用户'
        person = Person.objects.create(name=username, email=email, user=user)

    setattr(user, 'person_id', str(person.id))
    return str(person.id)

class EvaluationTaskViewSet(viewsets.ModelViewSet):
    queryset = EvaluationTask.objects.filter(deleted_at__isnull=True).order_by('-created_at')
    serializer_class = EvaluationTaskSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'assignee', 'status', 'source', 'batch_id']
    search_fields = ['student__nickname', 'assignee__name']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset().select_related('student', 'assignee')
        params = self.request.query_params
        assignee_me = params.get('assignee_me')
        assignee_id = params.get('assignee_id')
        # 修改：通过工具函数解析当前人员ID
        me_person_id = resolve_person_id(self.request.user)

        target_id = None
        if assignee_me in ('1', 'true', 'True') and me_person_id:
            target_id = me_person_id
        elif assignee_id:
            target_id = assignee_id

        if target_id:
            qs = qs.filter(assignee_id=target_id)
        return qs

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """
        开始处理任务（占位）
        期望：pending -> in_progress 幂等
        """
        from rest_framework.response import Response
        from rest_framework import status
        return Response(
            {'detail': 'Not implemented: start task pending design.'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """
        提交点评：
        - 校验内容
        - 创建 FeedbackRecord
        - 更新任务状态为 completed
        """
        data = request.data or {}
        content = (data.get('teacher_content') or '').strip()
        if not content or len(content) < 5:
            return Response({'detail': 'teacher_content 至少 5 个字符'}, status=status.HTTP_400_BAD_REQUEST)

        teacher_person_id = resolve_person_id(request.user)
        if not teacher_person_id:
            return Response({'detail': '当前账号未绑定人员，无法提交点评'}, status=status.HTTP_400_BAD_REQUEST)
        # 后续逻辑保持不变（校验任务、权限、写入 FeedbackRecord、更新任务状态）
        task = EvaluationTask.objects.filter(deleted_at__isnull=True, pk=pk).select_related('student', 'assignee').first()
        if not task:
            return Response({'detail': '任务不存在'}, status=status.HTTP_404_NOT_FOUND)

        if str(task.assignee_id) != str(teacher_person_id):
            return Response({'detail': '你不是该任务的负责人，无法提交'}, status=status.HTTP_403_FORBIDDEN)

        if task.status == 'completed':
            return Response({'detail': '该任务已完成，无需重复提交'}, status=status.HTTP_400_BAD_REQUEST)

        produce_impression = bool(data.get('produce_impression', False))
        impression_text = (data.get('impression_text') or '').strip() if produce_impression else None

        with transaction.atomic():
            fb = FeedbackRecord.objects.create(
                task_id=task.id,
                student_id=task.student_id,
                teacher_id=teacher_person_id,
                teacher_content=content,
                produce_impression=produce_impression,
                impression_text=impression_text,
                created_by_id=teacher_person_id,
                updated_by_id=teacher_person_id,
            )

            task.status = 'completed'
            task.updated_by_id = teacher_person_id
            task.updated_at = timezone.now()
            task.save(update_fields=['status', 'updated_by', 'updated_at'])

        ser = FeedbackRecordSerializer(fb)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_create_tasks(self, request):
        """
        批量创建点评任务（同一批次）
        Body:
        {
          "assignee": "<uuid>",
          "students": ["<uuid>", ...],
          "note": "批次备注(可选)",
          "batch_id": "<uuid>(可选)"
        }
        """
        data = request.data or {}
        assignee_id = data.get('assignee')
        students = data.get('students') or []
        note = data.get('note') or None
        batch_id = data.get('batch_id') or str(uuid.uuid4())

        if not assignee_id:
            return Response({"detail": "assignee is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(students, (list, tuple)) or len(students) == 0:
            return Response({"detail": "students must be a non-empty array"}, status=status.HTTP_400_BAD_REQUEST)

        # 基本UUID格式校验（防止数据库层异常）
        try:
            uuid.UUID(str(assignee_id))
            for sid in students:
                uuid.UUID(str(sid))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid UUID in assignee or students"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        # 修改：用于 created_by/updated_by 字段
        person_id = resolve_person_id(request.user)

        objs = []
        for sid in students:
            objs.append(EvaluationTask(
                batch_id=batch_id,
                student_id=sid,
                assignee_id=assignee_id,
                status='pending',
                source='researcher',
                note=note,
                created_at=now,
                updated_at=now,
                created_by_id=person_id,
                updated_by_id=person_id,
            ))

        EvaluationTask.objects.bulk_create(objs, batch_size=1000)

        return Response({
            "batch_id": batch_id,
            "created": len(objs)
        }, status=status.HTTP_201_CREATED)

class FeedbackPagination(PageNumberPagination):
    page_query_param = 'page'
    page_size_query_param = 'size'
    page_size = 20
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'items': data,
            'page': self.page.number,
            'size': self.get_page_size(self.request) or self.page.paginator.per_page,
            'total': self.page.paginator.count,
        })

class FeedbackRecordViewSet(ModelViewSet):
    queryset = FeedbackRecord.objects.filter(deleted_at__isnull=True).order_by('-created_at')
    serializer_class = FeedbackRecordSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'teacher', 'task']
    search_fields = ['student__nickname', 'teacher__name']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    pagination_class = FeedbackPagination

    def get_queryset(self):
        # 选择需要的关联，避免 N+1
        qs = FeedbackRecord.objects.filter(deleted_at__isnull=True) \
            .select_related('student', 'teacher', 'task')
        params = self.request.query_params

        # 解析“当前人员”
        me_person_id = resolve_person_id(self.request.user)

        # 我的点评历史：teacher_me=1|true
        teacher_me = params.get('teacher_me')
        if teacher_me in ('1', 'true', 'True') and me_person_id:
            qs = qs.filter(teacher_id=me_person_id)

        # 指定学员：用于学员信息弹窗内加载其历史点评
        student_id = params.get('student') or params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        # 时间范围（可选）：按 created_at 过滤
        start = params.get('start')
        end = params.get('end')
        if start:
            dt = parse_datetime(start)
            if not dt:
                d = parse_date(start)
                if d:
                    tz = timezone.get_current_timezone()
                    dt = timezone.make_aware(datetime.datetime.combine(d, datetime.time.min), tz)
            if dt:
                qs = qs.filter(created_at__gte=dt)
        if end:
            dt = parse_datetime(end)
            if not dt:
                d = parse_date(end)
                if d:
                    tz = timezone.get_current_timezone()
                    dt = timezone.make_aware(datetime.datetime.combine(d, datetime.time.max), tz)
            if dt:
                qs = qs.filter(created_at__lte=dt)

        # 关键字别名（可选）：q -> 学员昵称/教师名
        q = params.get('q')
        if q:
            qs = qs.filter(Q(student__nickname__icontains=q) | Q(teacher__name__icontains=q))

        return qs

# 新增：反馈曲目明细 ViewSet
class FeedbackPieceDetailViewSet(ModelViewSet):
    queryset = FeedbackPieceDetail.objects.filter(deleted_at__isnull=True) \
        .select_related('feedback', 'piece', 'course_version', 'lesson_version') \
        .order_by('-created_at')
    serializer_class = FeedbackPieceDetailSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        'feedback',
        'piece',
        'course_version',
        'lesson_version',
        # 跨表过滤：按学员筛选某学员的曲目明细
        'feedback__student',
    ]
    # 允许按曲目名搜索（若 courses.Piece 存在 name 字段）
    search_fields = ['piece__name']
    ordering_fields = ['created_at', 'updated_at', 'piece']
    ordering = ['-created_at']

# 新增：点评任务批次列表（供 researcher.js 使用）
class EvaluationTaskBatchListView(APIView):
    def get(self, request):
        try:
            limit = int(request.query_params.get('limit', 20))
        except ValueError:
            limit = 20
        limit = max(1, min(limit, 200))

        qs = (EvaluationTask.objects
              .filter(deleted_at__isnull=True, batch_id__isnull=False)
              .values('batch_id')
              .annotate(
                  count=Count('id'),
                  first_created_at=Min('created_at'),
                  last_created_at=Max('created_at'),
              )
              .order_by('-last_created_at')[:limit])

        items = [{
            'batch_id': str(row['batch_id']),
            'count': row['count'],
            'first_created_at': row['first_created_at'],
            'last_created_at': row['last_created_at'],
        } for row in qs]

        return Response({'items': items}, status=status.HTTP_200_OK)

# 新增：点评任务批次详情
class EvaluationTaskBatchDetailView(APIView):
    def get(self, request, batch_id):
        tasks_qs = (EvaluationTask.objects
                    .filter(deleted_at__isnull=True, batch_id=batch_id)
                    .select_related('student', 'assignee')
                    .order_by('-created_at'))

        agg = tasks_qs.aggregate(
            count=Count('id'),
            first_created_at=Min('created_at'),
            last_created_at=Max('created_at'),
        )

        # 返回少量必要字段，避免过大响应；如需完整字段可改用序列化器
        tasks = [{
            'id': t.id,
            'student': t.student_id,
            'student_nickname': getattr(t.student, 'nickname', None),
            'assignee': t.assignee_id,
            'assignee_name': getattr(t.assignee, 'name', None),
            'status': t.status,
            'created_at': t.created_at,
        } for t in tasks_qs[:500]]

        return Response({
            'batch_id': str(batch_id),
            'count': agg.get('count') or 0,
            'first_created_at': agg.get('first_created_at'),
            'last_created_at': agg.get('last_created_at'),
            'tasks': tasks,
        }, status=status.HTTP_200_OK)

# 新增：运营反馈导出（占位，后续可实现CSV/Excel导出）
class OpsFeedbackExportView(APIView):
    def get(self, request):
        return Response({'detail': 'Not implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)

# 新增：教研反馈导出（占位）
class ResearchFeedbackExportView(APIView):
    def get(self, request):
        return Response({'detail': 'Not implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)

# 新增：教研工作量统计（占位）
class WorkloadsView(APIView):
    def get(self, request):
        return Response({'detail': 'Not implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)

