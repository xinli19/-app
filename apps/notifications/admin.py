from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'type', 'title', 'recipient', 'sender',
        'is_read', 'read_at', 'created_at'
    )
    list_filter = ('type', 'is_read')
    search_fields = ('title', 'message', 'recipient__name', 'sender__name')
    ordering = ('-created_at',)