from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
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

class FeedbackRecordViewSet(viewsets.ModelViewSet):
    queryset = FeedbackRecord.objects.filter(deleted_at__isnull=True).order_by('-created_at')
    serializer_class = FeedbackRecordSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'teacher', 'task']
    search_fields = ['student__nickname', 'teacher__name']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

class FeedbackPieceDetailViewSet(viewsets.ModelViewSet):
    queryset = FeedbackPieceDetail.objects.filter(deleted_at__isnull=True).order_by('-created_at')
    serializer_class = FeedbackPieceDetailSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['feedback', 'piece']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
