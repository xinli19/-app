from django.contrib import admin
from .models import Announcement

@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('type', 'publisher', 'start_at', 'end_at', 'created_at')
    list_filter = ('type', 'publisher')
    search_fields = ('content', 'publisher__name')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)