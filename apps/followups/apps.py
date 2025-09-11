from django.apps import AppConfig


class FollowupsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.followups'
    label = 'followups'
    verbose_name = '回访管理'