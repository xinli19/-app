"""
课程应用配置
"""
from django.apps import AppConfig


class CoursesConfig(AppConfig):
    """
    课程应用配置类
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.courses'
    verbose_name = '课程管理'
    
    def ready(self):
        """
        应用准备就绪时的初始化操作
        """
        pass