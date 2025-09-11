from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Notification
from .serializers import NotificationSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    queryset = (Notification.objects
                .select_related('recipient', 'sender')
                .all()
                .order_by('-created_at'))
    serializer_class = NotificationSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['recipient', 'is_read', 'type', 'link_type']
    search_fields = ['title', 'message']
    ordering_fields = ['created_at', 'read_at']

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        obj = self.get_object()
        if not obj.is_read:
            obj.is_read = True
            obj.read_at = timezone.now()
            obj.save(update_fields=['is_read', 'read_at', 'updated_at'])
        return Response(self.get_serializer(obj).data)