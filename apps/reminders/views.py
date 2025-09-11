from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter

from .models import Reminder
from .serializers import ReminderSerializer

class ReminderViewSet(viewsets.ModelViewSet):
    queryset = Reminder.objects.all().order_by('-created_at')
    serializer_class = ReminderSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'urgency', 'sender', 'receiver', 'student']
    search_fields = ['content']
    ordering_fields = ['created_at', 'start_at', 'end_at']