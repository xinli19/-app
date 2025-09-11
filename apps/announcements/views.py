from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Announcement
from .serializers import AnnouncementSerializer

class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.all().order_by('-created_at')
    serializer_class = AnnouncementSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type', 'publisher']
    search_fields = ['content']
    ordering_fields = ['created_at', 'start_at', 'end_at']

    @action(detail=False, methods=['get'])
    def active(self, request):
        now = timezone.now()
        qs = Announcement.objects.filter(
            start_at__lte=now
        ).filter(
            models.Q(end_at__isnull=True) | models.Q(end_at__gte=now)
        ).order_by('-start_at')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)