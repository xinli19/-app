from django.contrib import admin
from django.db.models import Count, Exists, OuterRef
from .models import EvaluationTask, FeedbackRecord, FeedbackPieceDetail, StudentPieceStatus


class FeedbackPieceDetailInline(admin.TabularInline):
    """
    点评曲目明细内联表格
    - 去版本化：使用 piece 作为唯一曲目标识
    - raw_id_fields 防止下拉卡顿，适合曲目数据规模增长
    """
    model = FeedbackPieceDetail
    extra = 0
    raw_id_fields = ['piece', 'course_version', 'lesson_version']
    verbose_name = '曲目明细'
    verbose_name_plural = '曲目明细列表'


@admin.register(FeedbackRecord)
class FeedbackRecordAdmin(admin.ModelAdmin):
    """
    点评记录管理
    - 展示点评的关联信息（学员、老师、任务来源）
    - 支持快速检索与过滤
    - 提供内联的曲目明细维护能力
    """
    list_display = (
        'student', 'teacher', 'task_source', 'produce_impression',
        'details_count', 'created_at',
    )
    list_filter = (
        'produce_impression',
        'teacher',
        'student',
        'task__source',       # 关联任务来源过滤
        'task__assignee',     # 关联任务指派人过滤
    )
    search_fields = (
        'student__nickname',  # 按学员昵称模糊查找
        'teacher__name',      # 按老师姓名模糊查找
        'teacher_content',    # 按点评正文模糊查找
        'impression_text',    # 按印象文本模糊查找
        'task__batch_id',     # 按任务批次号检索（UUID文本）
    )
    date_hierarchy = 'created_at'
    inlines = [FeedbackPieceDetailInline]
    list_select_related = ('student', 'teacher', 'task')
    raw_id_fields = ['task', 'student', 'teacher']

    def get_queryset(self, request):
        """
        定制查询集：
        - select_related 预取外键，减少 N+1 查询
        - annotate 统计曲目明细数量，便于在列表中展示
        """
        qs = super().get_queryset(request)
        return qs.select_related('student', 'teacher', 'task').annotate(
            _details_count=Count('details', distinct=True)
        )

    def details_count(self, obj):
        """
        列表中展示“曲目明细数量”
        依赖 get_queryset 的 annotate 结果，回退逻辑为关联计数（少量数据下影响可忽略）
        """
        return getattr(obj, '_details_count', None) or obj.details.count()
    details_count.short_description = '曲目明细数'
    details_count.admin_order_field = '_details_count'

    def task_source(self, obj):
        """
        列表中展示“任务来源”的可读文本
        使用 choices 的 get_FOO_display() 将枚举值转为中文显示
        """
        if obj.task_id:
            return obj.task.get_source_display()
        return '-'
    task_source.short_description = '任务来源'
    task_source.admin_order_field = 'task__source'

    @admin.action(description='批量设为“产出当前印象”')
    def make_produce_impression(self, request, queryset):
        """
        批量动作：将选中的点评记录标记为“产出当前印象”
        注意：如果你的业务需要校验 impression_text 非空，可在此处加上过滤条件
        """
        updated = queryset.update(produce_impression=True)
        self.message_user(request, f'已更新 {updated} 条点评记录为“产出当前印象”。')

    @admin.action(description='批量取消“产出当前印象”')
    def clear_produce_impression(self, request, queryset):
        """
        批量动作：将选中的点评记录取消“产出当前印象”
        """
        updated = queryset.update(produce_impression=False)
        self.message_user(request, f'已更新 {updated} 条点评记录为“未产出当前印象”。')

    actions = ['make_produce_impression', 'clear_produce_impression']


@admin.register(EvaluationTask)
class EvaluationTaskAdmin(admin.ModelAdmin):
    """
    点评任务管理
    - 快速查看任务状态与负责人
    - 支持按状态、来源、负责人、学员过滤
    - 提供批量状态变更动作
    """
    list_display = (
        'student', 'assignee', 'status', 'source', 'has_feedback_flag', 'created_at',
    )
    list_filter = (
        'status', 'source', 'assignee', 'student',
    )
    search_fields = (
        'student__nickname',  # 学员昵称
        'assignee__name',     # 教师姓名
        'note',               # 任务备注
        'batch_id',           # 批次号（UUID文本）
    )
    date_hierarchy = 'created_at'
    list_select_related = ('student', 'assignee')
    raw_id_fields = ['student', 'assignee']

    def get_queryset(self, request):
        """
        定制查询集：
        - select_related 预取外键
        - 使用 Exists 子查询标记该任务是否已有反馈，便于列表中以布尔显示
        """
        qs = super().get_queryset(request).select_related('student', 'assignee')
        feedback_qs = FeedbackRecord.objects.filter(task_id=OuterRef('pk'))
        return qs.annotate(_has_feedback=Exists(feedback_qs))

    def has_feedback_flag(self, obj):
        """
        列表布尔列：是否已有反馈记录
        依赖 get_queryset 注入的 _has_feedback 注解，避免逐行查询
        """
        return bool(getattr(obj, '_has_feedback', False))
    has_feedback_flag.boolean = True
    has_feedback_flag.short_description = '已反馈'
    has_feedback_flag.admin_order_field = '_has_feedback'

    @admin.action(description='标记为：待处理')
    def mark_status_pending(self, request, queryset):
        """
        批量动作：将任务状态修改为“待处理”
        """
        updated = queryset.update(status='PENDING')
        self.message_user(request, f'已将 {updated} 条任务置为“待处理”。')

    @admin.action(description='标记为：进行中')
    def mark_status_in_progress(self, request, queryset):
        """
        批量动作：将任务状态修改为“进行中”
        """
        updated = queryset.update(status='IN_PROGRESS')
        self.message_user(request, f'已将 {updated} 条任务置为“进行中”。')

    @admin.action(description='标记为：已完成')
    def mark_status_done(self, request, queryset):
        """
        批量动作：将任务状态修改为“已完成”
        """
        updated = queryset.update(status='DONE')
        self.message_user(request, f'已将 {updated} 条任务置为“已完成”。')

    actions = ['mark_status_pending', 'mark_status_in_progress', 'mark_status_done']


@admin.register(StudentPieceStatus)
class StudentPieceStatusAdmin(admin.ModelAdmin):
    """
    学员曲目状态管理
    - 列表展示学员、曲目、被点评次数、最后点评时间和最近溯源的点评记录与教师
    - 支持按学员/曲目筛选、按学员昵称/曲目名/教师姓名搜索
    - 使用 select_related/raw_id_fields 优化外键查询性能
    """
    list_display = (
        'student', 'piece', 'review_count', 'last_reviewed_at',
        'last_feedback', 'last_feedback_teacher',
    )
    list_filter = (
        'student', 'piece',
    )
    search_fields = (
        'student__nickname',       # 学员昵称模糊搜索
        'piece__name',             # 曲目名模糊搜索
        'last_feedback__teacher__name',  # 最近一次反馈老师姓名
    )
    date_hierarchy = 'last_reviewed_at'
    ordering = ('-last_reviewed_at', '-review_count')
    list_select_related = ('student', 'piece', 'last_feedback', 'last_feedback__teacher')
    raw_id_fields = ['student', 'piece', 'last_feedback']

    def get_queryset(self, request):
        """
        定制查询集：
        - 通过 select_related 预取学员、曲目和最近反馈的教师，减少列表展示时的 N+1 查询；
        - 当前无需 annotate 聚合统计（review_count 为已有字段）。
        """
        qs = super().get_queryset(request)
        return qs.select_related('student', 'piece', 'last_feedback', 'last_feedback__teacher')

    def last_feedback_teacher(self, obj):
        """
        列表辅助列：展示最近一次更新本状态的点评记录的“教师姓名”
        若无最近反馈（被删除或尚未产生），返回 '-' 占位。
        """
        if obj.last_feedback_id and obj.last_feedback and obj.last_feedback.teacher_id:
            return obj.last_feedback.teacher.name
        return '-'
    last_feedback_teacher.short_description = '最近反馈教师'
    last_feedback_teacher.admin_order_field = 'last_feedback__teacher__name'

# 可选：如果希望单独管理曲目明细（非内联），取消注释以下注册
# @admin.register(FeedbackPieceDetail)
# class FeedbackPieceDetailAdmin(admin.ModelAdmin):
#     """
#     点评曲目明细（独立列表）
#     一般建议通过“点评记录”内联维护，这里仅在需要时启用
#     """
#     list_display = ('feedback', 'piece_version', 'course_version', 'lesson_version', 'created_at')
#     list_filter = ('course_version', 'lesson_version')
#     search_fields = ('feedback__student__nickname', 'piece_version__piece__name')
#     raw_id_fields = ['feedback', 'piece_version', 'course_version', 'lesson_version']
