from rest_framework import serializers
from .models import Reminder, ReminderRecipient
from apps.persons.models import Person
from apps.evaluations.serializers import FeedbackPieceDetailSerializer


class ReminderSerializer(serializers.ModelSerializer):
    # 新增：多接收人（写入用）
    recipients = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True
    )

    # 只读：若本提醒关联了某条点评，则附带该点评的曲目刻度明细
    feedback_details = FeedbackPieceDetailSerializer(source='feedback.details', many=True, read_only=True)

    class Meta:
        model = Reminder
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'deleted_at', 'e2e_type']
        extra_kwargs = {
            'sender': {'required': False},  # 放宽 sender 为非必填
        }

    def validate(self, attrs):
        # 基本校验：内容非空；至少一个接收人（receiver 或 recipients）
        content = (attrs.get('content') or '').strip()
        if not content:
            raise serializers.ValidationError({'content': '内容不能为空'})

        recipients = self.initial_data.get('recipients', None)
        receiver = attrs.get('receiver', None)
        if not receiver and (not recipients or (isinstance(recipients, list) and len(recipients) == 0)):
            raise serializers.ValidationError({'recipients': '至少选择一个接收人'})

        return attrs

    def create(self, validated_data):
        # 拿出 recipients（不属于模型字段）
        recipient_ids = validated_data.pop('recipients', None)
        reminder = super().create(validated_data)

        persons = []
        if recipient_ids:
            persons = list(Person.objects.filter(id__in=recipient_ids))

        # 若传了 primary receiver，则并入集合，保持与子表一致
        if reminder.receiver and all(str(p.id) != str(reminder.receiver_id) for p in persons):
            persons = [reminder.receiver] + persons

        if persons:
            # 统一通过子表维护接收人并自动刷新 e2e_type
            reminder.set_recipients(persons, clear_existing=True)
        else:
            # 兼容：如果没有 recipients 但提供了 receiver，维持旧行为
            receiver = reminder.receiver
            if receiver:
                ReminderRecipient.objects.get_or_create(
                    reminder=reminder,
                    person=receiver,
                    defaults={'created_by': reminder.created_by, 'updated_by': reminder.updated_by}
                )
        return reminder