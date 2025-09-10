from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Student, StudentTag
from .serializers import StudentSerializer, StudentTagSerializer
from .models import CourseRecord
from .serializers import CourseRecordSerializer

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all().order_by('-created_at')
    serializer_class = StudentSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'tags']
    search_fields = ['nickname', 'xiaoetong_id', 'remark_name']
    ordering_fields = ['created_at', 'nickname']
    ordering = ['-created_at']

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