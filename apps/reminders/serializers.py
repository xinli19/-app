from rest_framework import serializers
from .models import Reminder, ReminderRecipient

class ReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reminder
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'deleted_at', 'e2e_type']

    def create(self, validated_data):
        reminder = super().create(validated_data)
        # 若提供了 receiver，则为其创建接收人子表记录（幂等：若已有则忽略）
        receiver = reminder.receiver
        if receiver:
            ReminderRecipient.objects.get_or_create(
                reminder=reminder,
                person=receiver,
                defaults={'created_by': reminder.created_by, 'updated_by': reminder.updated_by}
            )
        return reminder