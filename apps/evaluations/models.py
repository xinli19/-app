from django.db import models
from apps.core.models import AuditModel
from apps.core.enums import TaskStatus, TaskSource
from django.utils import timezone
from django.db import transaction
from django.db.models import F

class EvaluationTask(AuditModel):
    """
    点评任务
    """
    batch_id = models.UUIDField(null=True, blank=True, verbose_name='批次号')
    student = models.ForeignKey('students.Student', on_delete=models.PROTECT, related_name='evaluation_tasks', verbose_name='学员')
    assignee = models.ForeignKey('persons.Person', on_delete=models.PROTECT, related_name='assigned_tasks', verbose_name='任务负责教师')
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING, verbose_name='状态')
    source = models.CharField(max_length=20, choices=TaskSource.choices, verbose_name='来源')
    note = models.TextField(null=True, blank=True, verbose_name='备注')

    class Meta:
        db_table = 'evaluations_evaluation_task'
        verbose_name = '点评任务'
        verbose_name_plural = '点评任务'
        indexes = [
            models.Index(fields=['assignee', 'status'], name='idx_task_assignee_status'),
            models.Index(fields=['student'], name='idx_task_student'),
            models.Index(fields=['batch_id'], name='idx_task_batch'),
            models.Index(fields=['source'], name='idx_task_source'),
        ]

    def __str__(self):
        return f"Task[{self.status}] for {self.student} -> {self.assignee}"

class FeedbackRecord(AuditModel):
    """
    点评记录（一任务一反馈）
    """
    task = models.OneToOneField('evaluations.EvaluationTask', on_delete=models.PROTECT, related_name='feedback', verbose_name='任务')
    student = models.ForeignKey('students.Student', on_delete=models.PROTECT, related_name='feedback_records', verbose_name='学员')
    teacher = models.ForeignKey('persons.Person', on_delete=models.PROTECT, related_name='feedback_given', verbose_name='点评教师')
    teacher_content = models.TextField(verbose_name='教师点评内容')
    researcher_feedback = models.TextField(null=True, blank=True, verbose_name='教研反馈')
    produce_impression = models.BooleanField(default=False, verbose_name='产出当前印象')
    impression_text = models.TextField(null=True, blank=True, verbose_name='印象文本')

    class Meta:
        db_table = 'evaluations_feedback_record'
        verbose_name = '点评记录'
        verbose_name_plural = '点评记录'
        indexes = [
            models.Index(fields=['student', 'created_at'], name='idx_feedback_student_created'),
            models.Index(fields=['teacher', 'created_at'], name='idx_feedback_teacher_created'),
            models.Index(fields=['task'], name='idx_feedback_task'),
        ]

    def __str__(self):
        return f"Feedback by {self.teacher} for {self.student}"

class FeedbackPieceDetail(AuditModel):
    """
    点评曲目明细（去除曲目版本依赖）
    变更说明：
    - 由原先绑定 courses.PieceVersion 调整为绑定 courses.Piece
    - 仍保留 course_version/lesson_version 作为上下文信息（可选），便于溯源到当时的课程结构版本
    """
    feedback = models.ForeignKey('evaluations.FeedbackRecord', on_delete=models.CASCADE, related_name='details', verbose_name='点评记录')
    piece = models.ForeignKey('courses.Piece', on_delete=models.PROTECT, related_name='feedback_details', verbose_name='曲目')
    course_version = models.ForeignKey('courses.CourseVersion', on_delete=models.PROTECT, null=True, blank=True, related_name='feedback_details', verbose_name='课程版本')
    lesson_version = models.ForeignKey('courses.LessonVersion', on_delete=models.PROTECT, null=True, blank=True, related_name='feedback_details', verbose_name='课次版本')

    class Meta:
        db_table = 'evaluations_feedback_piece_detail'
        verbose_name = '点评曲目明细'
        verbose_name_plural = '点评曲目明细'
        constraints = [
            models.UniqueConstraint(fields=['feedback', 'piece'], name='uq_feedback_piece')
        ]
        indexes = [
            models.Index(fields=['feedback'], name='idx_fpd_feedback'),
            models.Index(fields=['piece'], name='idx_fpd_piece'),
        ]

    def __str__(self):
        return f"Detail(piece={self.piece_id}) of feedback={self.feedback_id}"

class StudentPieceStatus(AuditModel):
    """
    学员曲目状态表（原“点评曲目状态表”）
    
    设计说明（严格依据需求文档）：
    - 统计“学员-曲目”的累计被点评次数与最近一次点评时间；
    - 关联“最近一次更新该状态的点评记录”用于溯源；考虑到教师可以删除自己的点评记录，采用 SET_NULL；
    - 唯一性：同一学员+同一曲目在未软删条件下唯一；
    - 高频筛选字段建立索引：学员、曲目、最后点评时间、被点评次数；
    - 时区：统一使用 UTC（由系统配置与字段默认行为保障）。
    """
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.PROTECT,
        related_name='piece_statuses',
        verbose_name='学员',
        help_text='状态所属的学员'
    )
    piece = models.ForeignKey(
        'courses.Piece',
        on_delete=models.PROTECT,
        related_name='student_statuses',
        verbose_name='曲目',
        help_text='状态所属的曲目'
    )
    last_feedback = models.ForeignKey(
        'evaluations.FeedbackRecord',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='affected_piece_statuses',
        verbose_name='关联点评记录',
        help_text='最近一次更新本状态的点评记录，允许为空以兼容点评记录被删除'
    )
    review_count = models.PositiveIntegerField(
        default=0,
        verbose_name='被点评次数',
        help_text='累计被点评的总次数（随每次点评递增）'
    )
    last_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='最后点评时间',
        help_text='最近一次被点评的UTC时间'
    )

    class Meta:
        db_table = 'evaluations_student_piece_status'
        verbose_name = '学员曲目状态'
        verbose_name_plural = '学员曲目状态'
        constraints = [
            # 未软删条件下，(student, piece) 唯一
            models.UniqueConstraint(
                fields=['student', 'piece'],
                condition=models.Q(deleted_at__isnull=True),
                name='uq_sps_student_piece_not_deleted'
            )
        ]
        indexes = [
            models.Index(fields=['student'], name='idx_sps_student'),
            models.Index(fields=['piece'], name='idx_sps_piece'),
            models.Index(fields=['last_reviewed_at'], name='idx_sps_last_reviewed'),
            models.Index(fields=['review_count'], name='idx_sps_review_count'),
        ]

    def __str__(self):
        """
        字符串表示：用于Admin/调试便于识别
        """
        return f"SPS(student={self.student_id}, piece={self.piece_id}, count={self.review_count})"

    def touch_with_feedback(self, feedback, at=None, save=True):
        """
        使用某条点评记录刷新本状态的溯源信息与“最后点评时间”。
        
        业务语义：
        - last_feedback 指向最近一次更新该状态的点评记录；
        - last_reviewed_at 标记最近一次被点评的时间戳（默认当前UTC）。
        
        注意：
        - 若传入的 feedback.student 与本记录 student 不一致，将抛出 ValueError；
        - 仅刷新“时间与溯源”，不负责递增计数（计数递增请使用 update_by_feedback）。
        
        Args:
            feedback (FeedbackRecord): 触发更新的点评记录
            at (datetime|None): 指定时间戳（UTC）；缺省使用 timezone.now()
            save (bool): 是否立即持久化（默认True）
        """
        if feedback.student_id != self.student_id:
            raise ValueError("反馈记录的学员与状态记录的学员不一致，禁止跨学员刷新状态")
        self.last_feedback = feedback
        self.last_reviewed_at = at or timezone.now()
        if save:
            self.save(update_fields=['last_feedback', 'last_reviewed_at', 'updated_at', 'updated_by'])

    @classmethod
    def update_by_feedback(cls, feedback):
        """
        基于一条点评记录批量更新“学员曲目状态表”。
        
        流程对应需求文档：
        1) 遍历点评曲目明细（FeedbackPieceDetail）
        2) 对每个曲目，按 (student, piece) 定位状态：
           - 若存在：被点评次数 +1
           - 若不存在：创建新记录，被点评次数 = 1
        3) 更新最后点评时间（UTC），并记录溯源 last_feedback
        
        特性：
        - 使用事务保证同一条反馈的状态更新原子性；
        - 使用 F 表达式避免并发下计数丢失；
        - 与“可删除点评记录”的规则兼容（状态保留，仅 last_feedback 可能变为 NULL）。
        
        Args:
            feedback (FeedbackRecord): 触发更新的点评记录
        
        Returns:
            int: 被处理的曲目明细数量（便于调用端统计与测试校验）
        """
        details_qs = feedback.details.select_related('piece').all()
        if not details_qs:
            return 0

        processed = 0
        with transaction.atomic():
            for d in details_qs:
                obj, created = cls.objects.get_or_create(
                    student=feedback.student,
                    piece=d.piece,
                    defaults={
                        'review_count': 0,
                        'last_feedback': None,
                        'last_reviewed_at': None,
                        'created_by': feedback.created_by,  # 溯源：创建者
                        'updated_by': feedback.updated_by,  # 初始与创建者一致
                    }
                )
                # 使用 F 表达式避免并发下的覆盖写
                cls.objects.filter(pk=obj.pk).update(
                    review_count=F('review_count') + 1,
                    last_feedback=feedback,
                    last_reviewed_at=timezone.now(),
                    updated_at=timezone.now(),
                    updated_by=feedback.updated_by
                )
                processed += 1
        return processed
