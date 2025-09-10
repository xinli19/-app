from django.contrib import admin
from .models import Student, StudentTag
from .models import CourseRecord

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('id', 'xiaoetong_id', 'nickname', 'remark_name', 'status', 'created_at', 'updated_at')
    search_fields = ('xiaoetong_id', 'nickname', 'remark_name')
    list_filter = ('status',)
    ordering = ('-created_at',)

    def has_delete_permission(self, request, obj=None):
        # 学员禁止删除
        return False

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        return actions

@admin.register(StudentTag)
class StudentTagAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description', 'created_at', 'updated_at')
    search_fields = ('name',)

@admin.register(CourseRecord)
class CourseRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'course', 'course_version', 'course_status', 'record_status', 'start_at', 'end_at', 'created_at')
    list_filter = ('course_status', 'record_status', 'course')
    search_fields = ('student__nickname', 'student__xiaoetong_id', 'course__name')
    ordering = ('-start_at',)