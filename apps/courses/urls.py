"""
课程应用URL配置
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'courses'

# 创建路由器
router = DefaultRouter()
router.register(r'', views.CourseViewSet, basename='course')
router.register(r'lessons', views.LessonViewSet, basename='lesson')
router.register(r'pieces', views.PieceViewSet, basename='piece')

urlpatterns = [
    path('', include(router.urls)),
]