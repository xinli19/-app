from django.contrib import admin
from .models import FollowUpRecord


@admin.register(FollowUpRecord)
class FollowUpRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'operator', 'seq_no', 'status', 'purpose', 'urgency', 'need_follow_up', 'next_follow_up_at', 'created_at')
    list_filter = ('status', 'purpose', 'urgency', 'need_follow_up')
    search_fields = ('student__name', 'operator__name', 'content', 'result')
    ordering = ('-created_at',)