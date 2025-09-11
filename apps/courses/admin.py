from django.contrib import admin
from .models import Course, Lesson, Piece, CourseVersion, LessonVersion

# 最小化注册，使用默认管理界面
admin.site.register(Course)
admin.site.register(Lesson)
admin.site.register(Piece)
admin.site.register(CourseVersion)
admin.site.register(LessonVersion)