from django.apps import AppConfig

class AnnouncementsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.announcements'
    label = 'announcements'
    verbose_name = '公告'