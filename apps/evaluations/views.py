from rest_framework import viewsets, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
import uuid
import datetime
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from .models import EvaluationTask, FeedbackRecord, FeedbackPieceDetail
from .serializers import EvaluationTaskSerializer, FeedbackRecordSerializer, FeedbackPieceDetailSerializer

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
        me_person_id = getattr(self.request.user, 'person_id', None)

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
        提交点评（占位）
        期望：校验内容长度 -> 新建反馈记录 -> 任务置 completed
        """
        from rest_framework.response import Response
        from rest_framework import status
        return Response(
            {'detail': 'Not implemented: submit feedback pending design.'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )

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
        request = self.request
        qs = FeedbackRecord.objects.all()
        params = self.request.query_params
        me_person_id = getattr(self.request.user, 'person_id', None)

        # 时间范围：支持 start/end 别名；原 start_at/end_at 兼容保留；默认取近15天
        def to_dt(val, is_end=False):
            if not val:
                return None
            dt = parse_datetime(val)
            if dt is None:
                d = parse_date(val)
                if d is not None:
                    dt = datetime.datetime.combine(
                        d,
                        datetime.time(23, 59, 59, 999999) if is_end else datetime.time.min
                    )
            if dt is not None and timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt

        start_raw = params.get('start') or params.get('start_at')
        end_raw = params.get('end') or params.get('end_at')
        start_at = to_dt(start_raw, is_end=False)
        end_at = to_dt(end_raw, is_end=True)
        if not start_at and not end_at:
            end_at = timezone.now()
            start_at = end_at - datetime.timedelta(days=15)

        if start_at:
            qs = qs.filter(created_at__gte=start_at)
        if end_at:
            qs = qs.filter(created_at__lte=end_at)

        # 关键词：学员昵称 / 教师姓名 / 点评正文
        q = params.get('q')
        if q:
            qs = qs.filter(
                Q(student__nickname__icontains=q) |
                Q(teacher__name__icontains=q) |
                Q(teacher_content__icontains=q)
            )

        # 教师筛选：teacher_me（按当前登录教师） 或 teacher_id
        teacher_me = params.get('teacher_me')
        teacher_id = params.get('teacher_id')
        if teacher_me in ('1', 'true', 'True') and me_person_id:
            qs = qs.filter(teacher_id=me_person_id)
        elif teacher_id:
            qs = qs.filter(teacher_id=teacher_id)

        # 学员筛选：student_id（别名）
        student_id = self.request.query_params.get("student_id")
        if student_id:
            try:
                uuid_obj = uuid.UUID(str(student_id))
            except (ValueError, TypeError):
                raise DRFValidationError({"student_id": "Invalid UUID format"})
            # 通过校验后再过滤
            queryset = queryset.filter(student_id=student_id)

        # 课程/曲目筛选：通过曲目明细关联
        need_distinct = False
        course_id = params.get('course_id')
        if course_id:
            qs = qs.filter(details__piece__course_id=course_id)
            need_distinct = True

        piece_id = params.get('piece_id')
        if piece_id:
            qs = qs.filter(details__piece_id=piece_id)
            need_distinct = True

        if need_distinct:
            qs = qs.distinct()

        return qs

    @action(detail=True, methods=['post'])
    def create_reminder(self, request, pk=None):
        """
        从点评创建提醒（占位）
        期待示例：
        {
            "category": "effect.bad",
            "urgency": "urgent",
            "content": "该生最近两次练习明显敷衍，请教研关注。",
            "recipients": [<person_id>, ...]
        }
        """
        from rest_framework.response import Response
        from rest_framework import status
        return Response(
            {"detail": "Not implemented: create reminder from feedback pending confirmation."},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )

class FeedbackPieceDetailViewSet(viewsets.ModelViewSet):
    queryset = FeedbackPieceDetail.objects.filter(deleted_at__isnull=True).order_by('-created_at')
    serializer_class = FeedbackPieceDetailSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['feedback', 'piece']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

class OpsFeedbackExportView(APIView):
    """
    运营点评记录导出占位端点：XLSX，后续落地字段白名单与命名规则
    """
    def post(self, request):
        return Response({'detail': 'Not implemented: export XLSX pending confirmation.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

class ResearchFeedbackExportView(APIView):
    """
    教研点评记录导出占位端点：XLSX，后续落地字段白名单与命名规则
    """
    def get(self, request):
        return Response({'detail': 'Not implemented: export XLSX pending confirmation.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

class WorkloadsView(APIView):
    """
    教研-工作量统计（最小能力）：
    - 统计某教师在时间段内的点评数量；
    - 返回 summary + 记录列表（受 limit 限制，默认 100）。
    """
    def get(self, request):
        from .models import FeedbackRecord
        from .serializers import FeedbackRecordSerializer

        teacher_id = request.query_params.get('teacher_id')
        if not teacher_id:
            return Response({'detail': 'teacher_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        def to_dt(val, is_end=False):
            if not val:
                return None
            dt = parse_datetime(val)
            if dt is None:
                d = parse_date(val)
                if d is not None:
                    dt = datetime.datetime.combine(
                        d,
                        datetime.time(23, 59, 59, 999999) if is_end else datetime.time.min
                    )
            if dt is not None and timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt

        start_at = to_dt(request.query_params.get('start_at'), is_end=False)
        end_at = to_dt(request.query_params.get('end_at'), is_end=True)
        if not start_at and not end_at:
            end_at = timezone.now()
            start_at = end_at - datetime.timedelta(days=7)

        qs = FeedbackRecord.objects.filter(
            deleted_at__isnull=True,
            teacher_id=teacher_id
        )
        if start_at:
            qs = qs.filter(created_at__gte=start_at)
        if end_at:
            qs = qs.filter(created_at__lte=end_at)

        total_count = qs.count()
        limit = request.query_params.get('limit')
        try:
            limit = int(limit) if limit is not None else 100
            limit = max(1, min(limit, 500))
        except ValueError:
            limit = 100

        items = qs.select_related('student', 'teacher', 'task').order_by('-created_at')[:limit]
        data = FeedbackRecordSerializer(items, many=True).data

        return Response({
            'teacher_id': int(teacher_id),
            'start_at': start_at,
            'end_at': end_at,
            'total_feedbacks': total_count,
            'limit': limit,
            'records': data,
        })
