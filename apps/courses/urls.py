"""
课程应用URL配置
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'courses'

# 创建路由器
router = DefaultRouter()
router.register(r'lessons', views.LessonViewSet, basename='lesson')  # 先注册明确前缀
router.register(r'pieces', views.PieceViewSet, basename='piece')     # 先注册明确前缀
router.register(r'', views.CourseViewSet, basename='course')         # 最后注册空前缀

urlpatterns = [
    path('', include(router.urls)),
]