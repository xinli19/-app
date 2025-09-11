from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Student, StudentTag
from .serializers import StudentSerializer, StudentTagSerializer
from .models import CourseRecord
from .serializers import CourseRecordSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all().order_by('-created_at')
    serializer_class = StudentSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'tags']
    search_fields = ['nickname', 'xiaoetong_id', 'remark_name']
    ordering_fields = ['created_at', 'nickname']
    ordering = ['-created_at']

    @action(detail=True, methods=['get'])
    def recent_feedbacks(self, request, pk=None):
        """
        最近历史点评记录（默认10条，可通过 ?limit= 调整，最大50）
        """
        from apps.evaluations.models import FeedbackRecord
        from apps.evaluations.serializers import FeedbackRecordSerializer

        try:
            limit = int(request.query_params.get('limit', 10))
        except ValueError:
            limit = 10
        limit = max(1, min(limit, 50))

        qs = FeedbackRecord.objects.filter(
            deleted_at__isnull=True,
            student_id=pk
        ).select_related('student', 'teacher', 'task').order_by('-created_at')[:limit]
        data = FeedbackRecordSerializer(qs, many=True).data
        return Response(data)

    @action(detail=True, methods=['post'], url_path='create-reminder')
    def create_reminder(self, request, pk=None):
        """
        从学员弹窗创建提醒（占位端点）
        预期 Body: { receiver, category, urgency, content, course_id?, piece_id? }
        说明: 后续实现将自动关联 student=pk，并做权限校验与字段验证
        """
        return Response({'detail': 'Not implemented: create reminder from student modal.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

class StudentTagViewSet(viewsets.ModelViewSet):
    queryset = StudentTag.objects.all().order_by('name')
    serializer_class = StudentTagSerializer

class CourseRecordViewSet(viewsets.ModelViewSet):
    queryset = CourseRecord.objects.filter(deleted_at__isnull=True).order_by('-start_at', '-created_at')
    serializer_class = CourseRecordSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'course', 'course_version', 'course_status', 'record_status']
    search_fields = ['student__nickname', 'student__xiaoetong_id', 'course__name']
    ordering_fields = ['start_at', 'created_at']
    ordering = ['-start_at', '-created_at']

class ImportPreviewView(APIView):
    """
    批量导入（预览）占位：最低映射（xiaoetong_id, nickname）后续实现
    """
    def post(self, request):
        return Response({'detail': 'Not implemented: import preview pending confirmation.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

class ImportCommitView(APIView):
    """
    批量导入（提交）占位：后续按最低映射落地
    """
    def post(self, request):
        return Response({'detail': 'Not implemented: import commit pending confirmation.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

class ImportBatchDetailView(APIView):
    """
    导入批次详情占位
    """
    def get(self, request, batch_id):
        return Response({'detail': 'Not implemented: import batch detail pending confirmation.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

class OpsStudentsExportView(APIView):
    """
    学员导出占位：XLSX，后续实现字段白名单与命名规则
    """
    def post(self, request):
        return Response({'detail': 'Not implemented: students export pending confirmation.'}, status=status.HTTP_501_NOT_IMPLEMENTED)