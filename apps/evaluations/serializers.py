from rest_framework import serializers
from .models import FeedbackRecord, FeedbackPieceDetail, EvaluationTask

class FeedbackPieceDetailSerializer(serializers.ModelSerializer):
    piece_name = serializers.ReadOnlyField(source='piece.name')
    class Meta:
        model = FeedbackPieceDetail
        fields = ['id', 'feedback', 'piece', 'course_version', 'lesson_version',
                  'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at', 'piece_name']
        read_only_fields = ['created_at', 'updated_at', 'deleted_at']

class FeedbackRecordSerializer(serializers.ModelSerializer):
    student_nickname = serializers.ReadOnlyField(source='student.nickname')
    teacher_name = serializers.ReadOnlyField(source='teacher.name')
    task_status = serializers.ReadOnlyField(source='task.status')
    details = FeedbackPieceDetailSerializer(many=True, read_only=True)
    content_text = serializers.ReadOnlyField(source='teacher_content')

    class Meta:
        model = FeedbackRecord
        fields = [
            'id', 'task', 'task_status',
            'student', 'student_nickname',
            'teacher', 'teacher_name',
            'teacher_content', 'content_text', 'researcher_feedback',
            'produce_impression', 'impression_text',
            'details',
            'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'deleted_at']

class EvaluationTaskSerializer(serializers.ModelSerializer):
    student_nickname = serializers.ReadOnlyField(source='student.nickname')
    assignee_name = serializers.ReadOnlyField(source='assignee.name')
    # 新增：任务对应点评摘要（空安全）
    last_teacher_content = serializers.SerializerMethodField(read_only=True)
    last_researcher_feedback = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = EvaluationTask
        fields = [
            'id', 'batch_id',
            'student', 'student_nickname',
            'assignee', 'assignee_name',
            'status', 'source', 'note',
            # 新增两个字段
            'last_teacher_content', 'last_researcher_feedback',
            'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'deleted_at']

    def get_last_teacher_content(self, obj):
        # 注意：OneToOne 反向访问器在没有记录时会抛 DoesNotExist，必须捕获
        try:
            fb = obj.feedback  # related_name='feedback'
        except FeedbackRecord.DoesNotExist:
            return None
        return fb.teacher_content or None

    def get_last_researcher_feedback(self, obj):
        try:
            fb = obj.feedback
        except FeedbackRecord.DoesNotExist:
            return None
        return fb.researcher_feedback or None
