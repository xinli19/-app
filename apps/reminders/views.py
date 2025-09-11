from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from django.utils import timezone
from django.db.models import Q
from apps.core.enums import EndToEndType
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.utils.dateparse import parse_datetime, parse_date
from datetime import datetime, time

from .models import Reminder, ReminderRecipient
from .serializers import ReminderSerializer

class ReminderViewSet(viewsets.ModelViewSet):
    queryset = Reminder.objects.all().order_by('-created_at')
    serializer_class = ReminderSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'urgency', 'sender', 'receiver', 'student', 'e2e_type']
    search_fields = ['content', 'student__nickname', 'student__xiaoetong_id', 'sender__name']
    ordering_fields = ['created_at', 'start_at', 'end_at', 'urgency']

    def get_queryset(self):
        qs = super().get_queryset().select_related('sender', 'receiver', 'student').prefetch_related('recipients')
        params = self.request.query_params

        # 收件箱：recipient_me 优先，其次 recipient_id（用于联调或无 User→Person 时）
        recipient_me = params.get('recipient_me')
        recipient_id = params.get('recipient_id')
        me_person_id = getattr(self.request.user, 'person_id', None)
        target_pid = None
        if recipient_me in ('1', 'true', 'True'):
            target_pid = me_person_id
        if not target_pid and recipient_id:
            target_pid = recipient_id
        if target_pid:
            qs = qs.filter(recipients__person_id=target_pid, recipients__deleted_at__isnull=True).distinct()

        # 仅生效提醒（支持 active/include_only_active 两种参数名）
        active = params.get('active')
        include_only_active = params.get('include_only_active') or active
        if include_only_active in ('1', 'true', 'True'):
            now = timezone.now()
            qs = qs.filter(Q(start_at__lte=now) & (Q(end_at__isnull=True) | Q(end_at__gte=now)))

        # 时间范围过滤（按创建时间 created_at）
        start = params.get('start')
        end = params.get('end')
        if start:
            dt = parse_datetime(start) or (lambda d: timezone.make_aware(datetime.combine(d, time.min), timezone.get_current_timezone()))(parse_date(start)) if parse_date(start) else None
            if dt:
                qs = qs.filter(created_at__gte=dt)
        if end:
            dt = parse_datetime(end) or (lambda d: timezone.make_aware(datetime.combine(d, time.max), timezone.get_current_timezone()))(parse_date(end)) if parse_date(end) else None
            if dt:
                qs = qs.filter(created_at__lte=dt)

        # 课程过滤（通过学员课程记录关联）
        course_id = params.get('course_id')
        if course_id:
            qs = qs.filter(
                student__course_records__course_id=course_id,
                student__course_records__deleted_at__isnull=True
            ).distinct()

        # 关键字搜索别名（q）：支持内容/学员昵称/小鹅通ID
        q = params.get('q')
        if q:
            qs = qs.filter(
                Q(content__icontains=q) |
                Q(student__nickname__icontains=q) |
                Q(student__xiaoetong_id__icontains=q)
            )

        # 教研视图：来源=教师/运营，推送给教研
        to_research = params.get('to_research')
        if to_research in ('1', 'true', 'True'):
            qs = qs.filter(e2e_type__in=[EndToEndType.T2R, EndToEndType.O2R])

        # 教师视图：来源=教研/运营，推送给教师
        to_teacher = params.get('to_teacher')
        if to_teacher in ('1', 'true', 'True'):
            qs = qs.filter(e2e_type__in=[EndToEndType.R2T, EndToEndType.O2T])

        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        me_person_id = getattr(request.user, 'person_id', None)
        allowed = False
        if me_person_id:
            if instance.sender_id == me_person_id:
                allowed = True
            elif instance.recipients.filter(person_id=me_person_id, deleted_at__isnull=True).exists():
                allowed = True
        if not allowed:
            return Response({'detail': 'Forbidden: no permission to view this reminder.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        me_person_id = getattr(request.user, 'person_id', None)
        if not me_person_id or instance.sender_id != me_person_id:
            return Response({'detail': 'Forbidden: only sender can delete this reminder.'}, status=status.HTTP_403_FORBIDDEN)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """
        将当前用户在该提醒上的收件状态标记为已读（幂等）
        """
        me_person_id = getattr(request.user, 'person_id', None)
        if not me_person_id:
            return Response({'detail': 'person_id not found on user.'}, status=status.HTTP_400_BAD_REQUEST)

        reminder = self.get_object()
        rr = reminder.recipients.filter(person_id=me_person_id, deleted_at__isnull=True).first()
        if not rr:
            return Response({'detail': 'recipient not found for current user.'}, status=status.HTTP_404_NOT_FOUND)
        rr.mark_read(save=True)
        return Response({'detail': 'ok'})

    @action(detail=True, methods=['post'], url_path='read')
    def read(self, request, pk=None):
        """
        标记单条提醒为已读（幂等）
        返回：{ id, read_at }
        """
        me_person_id = getattr(request.user, 'person_id', None)
        if not me_person_id:
            return Response({'detail': 'person_id not found on user.'}, status=status.HTTP_400_BAD_REQUEST)

        reminder = self.get_object()
        rr = reminder.recipients.filter(person_id=me_person_id, deleted_at__isnull=True).first()
        if not rr:
            return Response({'detail': 'recipient not found for current user.'}, status=status.HTTP_404_NOT_FOUND)
        rr.mark_read(save=True)
        return Response({'id': reminder.id, 'read_at': rr.read_at})

    @action(detail=False, methods=['post'], url_path='read-bulk')
    def read_bulk(self, request):
        """
        批量标记提醒为已读（幂等）
        Body: { "ids": [<reminder_id>, ...] }
        返回：{ "updated": <number> }
        仅更新“当前用户为接收人”的未读项
        """
        me_person_id = getattr(request.user, 'person_id', None)
        if not me_person_id:
            return Response({'detail': 'person_id not found on user.'}, status=status.HTTP_400_BAD_REQUEST)

        ids = request.data.get('ids') or []
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        qs = ReminderRecipient.objects.filter(
            person_id=me_person_id,
            deleted_at__isnull=True,
            reminder_id__in=ids,
            is_read=False
        )
        updated = qs.update(is_read=True, read_at=now)
        return Response({'updated': updated})

    @action(detail=True, methods=['post'], url_path='snooze')
    def snooze(self, request, pk=None):
        """
        延后处理（占位）：返回 501，等待交互与字段设计确定
        """
        return Response(
            {'detail': 'Not implemented: snooze pending design.'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )