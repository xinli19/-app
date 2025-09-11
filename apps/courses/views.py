"""
课程应用视图
提供课程相关的API接口
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from .models import Course, Lesson, Piece, CourseVersion
from .serializers import (
    CourseSerializer, LessonSerializer, PieceSerializer, CourseVersionSerializer
)
from rest_framework.filters import SearchFilter  # 新增


class CourseViewSet(viewsets.ModelViewSet):
    """
    课程视图集
    提供课程的CRUD操作
    """
    queryset = Course.objects.filter(deleted_at__isnull=True)
    serializer_class = CourseSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    @action(detail=True, methods=['get'])
    def lessons(self, request, pk=None):
        """
        获取课程下的所有课
        """
        course = self.get_object()
        lessons = course.lessons.filter(
            deleted_at__isnull=True
        ).order_by('sort_order')
        
        serializer = LessonSerializer(lessons, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def pieces(self, request, pk=None):
        """
        获取课程下的所有曲目
        """
        course = self.get_object()
        pieces = course.pieces.filter(
            deleted_at__isnull=True
        ).order_by('lesson__sort_order', 'name')
        
        serializer = PieceSerializer(pieces, many=True)
        return Response(serializer.data)


class LessonViewSet(viewsets.ModelViewSet):
    """
    课视图集
    提供课的CRUD操作
    """
    queryset = Lesson.objects.filter(deleted_at__isnull=True)
    serializer_class = LessonSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['course', 'status']
    search_fields = ['name', 'description']
    ordering_fields = ['sort_order', 'created_at']
    ordering = ['course', 'sort_order']
    
    @action(detail=True, methods=['get'])
    def pieces(self, request, pk=None):
        """
        获取课下的所有曲目
        """
        lesson = self.get_object()
        pieces = lesson.pieces.filter(
            deleted_at__isnull=True
        ).order_by('name')
        
        serializer = PieceSerializer(pieces, many=True)
        return Response(serializer.data)


class PieceViewSet(viewsets.ModelViewSet):
    """
    曲目视图集
    提供曲目的CRUD操作
    """
    queryset = Piece.objects.filter(deleted_at__isnull=True)
    serializer_class = PieceSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]  # 修改：加入 SearchFilter
    filterset_fields = ['course', 'lesson', 'status', 'attribute', 'is_required']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['course', 'lesson__sort_order', 'name']


class CourseVersionViewSet(viewsets.ModelViewSet):
    """
    课程版本视图集
    提供课程版本的CRUD操作
    """
    queryset = CourseVersion.objects.filter(deleted_at__isnull=True)
    serializer_class = CourseVersionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['course', 'status']
    search_fields = ['version_label']
    ordering_fields = ['version_label', 'released_at', 'created_at']
    ordering = ['-released_at', '-created_at']
    
    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        """
        发布课程版本
        """
        version = self.get_object()
        
        if version.is_released():
            return Response(
                {'error': '该版本已经发布'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        version.release()
        serializer = self.get_serializer(version)
        return Response(serializer.data)