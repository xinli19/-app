from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from django.utils.dateparse import parse_datetime, parse_date
import datetime
from rest_framework.exceptions import ValidationError

from .models import FollowUpRecord
from .serializers import FollowUpRecordSerializer
from apps.core.enums import FollowUpStatus

class FollowUpRecordViewSet(viewsets.ModelViewSet):
    queryset = (FollowUpRecord.objects
                .select_related('student', 'operator')
                .all()
                .order_by('-created_at'))
    serializer_class = FollowUpRecordSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'operator', 'status', 'urgency', 'need_follow_up']
    search_fields = ['content', 'result']
    ordering_fields = ['created_at', 'next_follow_up_at']

    @action(detail=True, methods=['post'])
    def mark_done(self, request, pk=None):
        obj = self.get_object()
        obj.status = FollowUpStatus.DONE
        obj.updated_at = timezone.now()
        obj.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(obj).data)

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # 时间范围过滤：created_at ∈ [start_at, end_at]
        start_at_raw = params.get('start_at')
        end_at_raw = params.get('end_at')

        def to_dt(val, is_end=False):
            if not val:
                return None
            dt = parse_datetime(val)
            if dt is None:
                d = parse_date(val)
                if d is not None:
                    if is_end:
                        dt = datetime.datetime.combine(d, datetime.time(23, 59, 59, 999999))
                    else:
                        dt = datetime.datetime.combine(d, datetime.time.min)
            if dt is not None and timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt

        start_at = to_dt(start_at_raw, is_end=False)
        end_at = to_dt(end_at_raw, is_end=True)
        if start_at:
            qs = qs.filter(created_at__gte=start_at)
        if end_at:
            qs = qs.filter(created_at__lte=end_at)

        # 学员关键词搜索（昵称 / 小鹅通ID）
        q = params.get('q')
        if q:
            qs = qs.filter(Q(student__nickname__icontains=q) | Q(student__xiaoetong_id__icontains=q))

        # 操作人过滤（别名：operator_id）
        operator_id = params.get('operator_id')
        if operator_id:
            qs = qs.filter(operator_id=operator_id)

        return qs

    def perform_create(self, serializer):
        me = getattr(self.request.user, 'person_profile', None)
        if not me:
            raise ValidationError({'operator': ['当前账号未绑定人员，无法创建回访']})
        serializer.save(operator=me)