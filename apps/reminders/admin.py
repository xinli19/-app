from django.contrib import admin
from .models import Reminder, ReminderRecipient

class ReminderRecipientInline(admin.TabularInline):
    """
    提醒接收人内联表：
    - 便于在提醒详情页直接维护接收人列表与已读状态；
    - raw_id_fields 适合大量人员数据时的性能优化。
    """
    model = ReminderRecipient
    extra = 0
    raw_id_fields = ['person']
    fields = ('person', 'is_read', 'read_at', 'created_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    """
    提醒事项管理：
    - 列表展示关键维度；
    - 支持筛选/检索；
    - 内联维护多接收人；
    - 常用批量操作。
    """
    list_display = (
        'category', 'urgency', 'e2e_type',
        'student', 'sender', 'receiver',
        'start_at', 'end_at', 'is_active_flag',
        'content_summary',
    )
    list_filter = (
        'category', 'urgency', 'e2e_type',
        'sender', 'receiver', 'student',
    )
    search_fields = (
        'content',
        'sender__name',
        'receiver__name',
        'student__nickname',
        'recipients__person__name',
    )
    date_hierarchy = 'start_at'
    ordering = ('-start_at', '-created_at')
    list_select_related = ('sender', 'receiver', 'student')
    raw_id_fields = ['sender', 'receiver', 'student', 'feedback']
    inlines = [ReminderRecipientInline]

    def content_summary(self, obj):
        """
        列表内容摘要：截断长文本，提升可读性
        """
        text = (obj.content or '').strip().replace('\n', ' ')
        return (text[:32] + '…') if len(text) > 32 else text
    content_summary.short_description = '内容摘要'

    def is_active_flag(self, obj):
        """
        列表布尔列：当前是否在有效期内
        """
        return obj.is_active()
    is_active_flag.boolean = True
    is_active_flag.short_description = '有效中'

    @admin.action(description='批量：全部接收人标记为已读')
    def mark_all_recipients_read(self, request, queryset):
        """
        批量操作：将选中提醒的所有接收人标记为已读（幂等）
        """
        updated_total = 0
        for r in queryset:
            before = r.recipients.filter(is_read=False).count()
            r.mark_all_read()
            updated_total += before
        self.message_user(request, f'共标记 {updated_total} 条接收记录为已读。')

    actions = ['mark_all_recipients_read']