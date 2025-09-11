from rest_framework import serializers
from .models import EvaluationTask, FeedbackRecord, FeedbackPieceDetail

class EvaluationTaskSerializer(serializers.ModelSerializer):
    student_nickname = serializers.ReadOnlyField(source='student.nickname')
    assignee_name = serializers.ReadOnlyField(source='assignee.name')

    class Meta:
        model = EvaluationTask
        fields = [
            'id', 'batch_id', 'student', 'student_nickname',
            'assignee', 'assignee_name', 'status', 'source', 'note',
            'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'deleted_at']

class FeedbackPieceDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackPieceDetail
        fields = ['id', 'feedback', 'piece', 'course_version', 'lesson_version',
                  'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at']
        read_only_fields = ['created_at', 'updated_at', 'deleted_at']

class FeedbackRecordSerializer(serializers.ModelSerializer):
    student_nickname = serializers.ReadOnlyField(source='student.nickname')
    teacher_name = serializers.ReadOnlyField(source='teacher.name')
    task_status = serializers.ReadOnlyField(source='task.status')
    details = FeedbackPieceDetailSerializer(many=True, read_only=True)

    class Meta:
        model = FeedbackRecord
        fields = [
            'id', 'task', 'task_status',
            'student', 'student_nickname',
            'teacher', 'teacher_name',
            'teacher_content', 'researcher_feedback',
            'produce_impression', 'impression_text',
            'details',
            'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'deleted_at']