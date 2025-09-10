from rest_framework import serializers
from .models import Student, StudentTag, CourseRecord

class StudentTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentTag
        fields = ['id', 'name', 'description']

class StudentSerializer(serializers.ModelSerializer):
    tags = serializers.PrimaryKeyRelatedField(
        queryset=StudentTag.objects.all(), many=True, required=False
    )
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'xiaoetong_id', 'nickname', 'remark_name', 'status',
            'teacher_impression_current', 'op_note', 'tags', 'tag_names',
            'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_tag_names(self, obj):
        return list(obj.tags.values_list('name', flat=True))

class CourseRecordSerializer(serializers.ModelSerializer):
    student_nickname = serializers.ReadOnlyField(source='student.nickname')
    course_name = serializers.ReadOnlyField(source='course.name')
    course_version_label = serializers.ReadOnlyField(source='course_version.version_label')

    class Meta:
        model = CourseRecord
        fields = [
            'id', 'student', 'student_nickname',
            'course', 'course_name',
            'course_version', 'course_version_label',
            'course_status', 'record_status',
            'start_at', 'end_at',
            'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'deleted_at']

    def validate(self, attrs):
        course = attrs.get('course') or getattr(self.instance, 'course', None)
        course_version = attrs.get('course_version') or getattr(self.instance, 'course_version', None)
        if course and course_version and getattr(course_version, 'course_id', None) and course_version.course_id != course.id:
            raise serializers.ValidationError('course_version 必须属于指定的 course')

        start_at = attrs.get('start_at') or getattr(self.instance, 'start_at', None)
        end_at = attrs.get('end_at') or getattr(self.instance, 'end_at', None)
        if start_at and end_at and end_at < start_at:
            raise serializers.ValidationError('end_at 不能早于 start_at')

        return attrs