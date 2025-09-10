"""
课程应用序列化器
用于API数据序列化和反序列化
"""
from rest_framework import serializers
from .models import Course, Lesson, Piece, CourseVersion, LessonVersion, PieceVersion


class CourseSerializer(serializers.ModelSerializer):
    """
    课程序列化器
    """
    lesson_count = serializers.ReadOnlyField(source='get_lesson_count')
    piece_count = serializers.ReadOnlyField(source='get_piece_count')
    required_piece_count = serializers.ReadOnlyField(source='get_required_piece_count')
    
    class Meta:
        model = Course
        fields = [
            'id', 'name', 'status', 'description',
            'lesson_count', 'piece_count', 'required_piece_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LessonSerializer(serializers.ModelSerializer):
    """
    课序列化器
    """
    course_name = serializers.ReadOnlyField(source='course.name')
    piece_count = serializers.ReadOnlyField(source='get_piece_count')
    required_piece_count = serializers.ReadOnlyField(source='get_required_piece_count')
    
    class Meta:
        model = Lesson
        fields = [
            'id', 'course', 'name', 'status', 'sort_order',
            'description', 'piece_count', 'required_piece_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PieceSerializer(serializers.ModelSerializer):
    """
    曲目序列化器
    """
    course_name = serializers.ReadOnlyField(source='course.name')
    lesson_name = serializers.ReadOnlyField(source='lesson.name')
    full_path = serializers.ReadOnlyField(source='get_full_path')
    attribute_display_with_required = serializers.ReadOnlyField(source='get_attribute_display_with_required')
    
    class Meta:
        model = Piece
        fields = [
            'id', 'course', 'course_name', 'lesson', 'lesson_name',
            'name', 'status', 'attribute', 'is_required', 'description',
            'full_path', 'attribute_display_with_required',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'course', 'created_at', 'updated_at']


class CourseVersionSerializer(serializers.ModelSerializer):
    """
    课程版本序列化器
    """
    course_name = serializers.ReadOnlyField(source='course.name')
    is_released = serializers.ReadOnlyField(source='is_released')
    
    class Meta:
        model = CourseVersion
        fields = [
            'id', 'course', 'course_name', 'version_label', 'status',
            'released_at', 'is_released', 'content_snapshot',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_released', 'content_snapshot', 'created_at', 'updated_at']