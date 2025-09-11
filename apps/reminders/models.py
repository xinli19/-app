from datetime import timedelta
from django.db import models, transaction
from django.utils import timezone
from apps.core.models import AuditModel
from apps.core.enums import UrgencyLevel, ReminderCategory, EndToEndType, RoleType

def default_one_week_later():
    """
    用于 end_at 的默认值：当前时间向后一周
    注意：作为可调用默认值，避免在模块导入时即求值。
    """
    return timezone.now() + timedelta(days=7)

class Reminder(AuditModel):
    """
    提醒事项
    设计说明（严格依据需求文档）：
    - 多接收人通过子表 ReminderRecipient 维护；
    - 端到端类别（e2e_type）由系统根据发送人与接收人角色自动填充（首次保存或显式调用计算）；
    - 生效时间窗口 [start_at, end_at]，end_at 为空视为仍有效；
    - 可关联学员与点评记录，用于上下文回溯；
    - 高频筛选字段建立索引，便于后台管理与查询。
    """
    sender = models.ForeignKey(
        'persons.Person',
        on_delete=models.PROTECT,
        related_name='sent_reminders',
        verbose_name='发送人',
        help_text='发送提醒的人员（教师/教研/运营）'
    )
    # 可选：单接收人便捷字段（与子表共存，不强制）
    receiver = models.ForeignKey(
        'persons.Person',
        on_delete=models.PROTECT,
        related_name='primary_received_reminders',
        null=True, blank=True,
        verbose_name='接收人（单）',
        help_text='便捷场景的单接收人，实际接收人集合以子表为准'
    )
    e2e_type = models.CharField(
        max_length=8,
        choices=EndToEndType.choices,
        verbose_name='端到端类别',
        help_text='系统根据发送人与接收人角色自动推断（T→R/T→O/R→T/R→O/O→T/O→R/O→O）'
    )
    urgency = models.CharField(
        max_length=16,
        choices=UrgencyLevel.choices,
        default=UrgencyLevel.NORMAL,
        verbose_name='紧急度',
        help_text='紧急需处理 / 不紧急需留意'
    )
    category = models.CharField(
        max_length=32,
        choices=ReminderCategory.choices,
        default=ReminderCategory.OTHER,
        verbose_name='提醒事项分类',
        help_text='例如：教学效果差、学员态度问题、有伤病等'
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.PROTECT,
        related_name='reminders',
        null=True, blank=True,
        verbose_name='关联学员',
        help_text='可选：提醒涉及的学员'
    )
    feedback = models.ForeignKey(
        'evaluations.FeedbackRecord',
        on_delete=models.SET_NULL,
        related_name='related_reminders',
        null=True, blank=True,
        verbose_name='关联点评记录',
        help_text='可选：提醒关联的点评上下文'
    )
    start_at = models.DateTimeField(
        default=timezone.now,
        verbose_name='开始时间',
        help_text='提醒事项开始生效的时间（UTC）'
    )
    end_at = models.DateTimeField(
        null=True, blank=True,
        default=default_one_week_later,
        verbose_name='结束时间',
        help_text='提醒事项结束时间（UTC），为空视为仍有效'
    )
    content = models.TextField(
        verbose_name='提醒内容',
        help_text='提醒内容的详细描述'
    )

    class Meta:
        db_table = 'reminders_reminder'
        verbose_name = '提醒事项'
        verbose_name_plural = '提醒事项'
        indexes = [
            models.Index(fields=['urgency'], name='idx_rmd_reminder_urgency'),
            models.Index(fields=['category'], name='idx_rmd_reminder_category'),
            models.Index(fields=['sender'], name='idx_rmd_reminder_sender'),
            models.Index(fields=['receiver'], name='idx_rmd_reminder_receiver'),
            models.Index(fields=['student'], name='idx_rmd_reminder_student'),
            models.Index(fields=['start_at'], name='idx_rmd_reminder_start'),
            models.Index(fields=['end_at'], name='idx_rmd_reminder_end'),
            models.Index(fields=['created_at'], name='idx_rmd_reminder_created'),
        ]

    def __str__(self):
        """
        字符串表示：前置显示分类/紧急度 + 内容摘要，方便 Admin 快速识别
        """
        summary = (self.content or '').strip().replace('\n', ' ')
        if len(summary) > 20:
            summary = summary[:20] + '…'
        return f"[{self.get_category_display()}|{self.get_urgency_display()}] {summary}"

    def clean(self):
        """
        基础校验：start_at 不得晚于 end_at（当 end_at 提供时）
        """
        super().clean()
        if self.end_at and self.start_at and self.start_at > self.end_at:
            raise ValueError('开始时间不可晚于结束时间')

    def is_active(self, at=None):
        """
        判断提醒事项在给定时间点是否有效。
        规则：at ∈ [start_at, end_at]；end_at 为空视为仍有效。
        
        Args:
            at (datetime|None): 检查时间点（UTC），默认=timezone.now()
        
        Returns:
            bool: 是否有效
        """
        at = at or timezone.now()
        if self.start_at and at < self.start_at:
            return False
        if self.end_at and at > self.end_at:
            return False
        return True

    def _pick_role_letter(self, person):
        """
        内部工具：取人员的“首选角色字母”（T/R/O），用于推断 e2e_type。
        若人员具备多角色，按优先级 Teacher > Researcher > Operator 选取。
        """
        roles = person.roles.values_list('role', flat=True)
        if RoleType.TEACHER in roles:
            return 'T'
        if RoleType.RESEARCHER in roles:
            return 'R'
        if RoleType.OPERATOR in roles:
            return 'O'
        return 'O'

    def save(self, *args, **kwargs):
        """
        重写保存：
        - 自动填充 e2e_type（若未设置）；
        - 保持审计字段的正常更新逻辑。
        """
        if not self.e2e_type:
            self.e2e_type = self.compute_e2e_type()
        super().save(*args, **kwargs)

    @transaction.atomic
    def set_recipients(self, persons, clear_existing=True):
        """
        便捷方法：设置多接收人子表。
        
        Args:
            persons (Iterable[Person]): 接收人集合
            clear_existing (bool): 是否清空已有接收人（默认 True）
        """
        if clear_existing:
            self.recipients.all().delete()
        seen = set()
        for p in persons or []:
            if p and p.id not in seen:
                ReminderRecipient.objects.create(reminder=self, person=p, created_by=self.created_by, updated_by=self.updated_by)
                seen.add(p.id)
        # 接收人变化可能导致 e2e_type 变化，刷新一次
        self.e2e_type = self.compute_e2e_type()
        self.save(update_fields=['e2e_type', 'updated_at', 'updated_by'])

    def mark_all_read(self, at=None):
        """
        便捷方法：将本条提醒的所有接收人标记为已读（幂等）。
        """
        at = at or timezone.now()
        self.recipients.filter(is_read=False).update(is_read=True, read_at=at, updated_at=at, updated_by=self.updated_by)


class ReminderRecipient(AuditModel):
    """
    提醒事项-接收人子表
    - 记录某人是否已读及读取时间；
    - 针对 (reminder, person) 建立唯一约束（未软删）。
    """
    reminder = models.ForeignKey(
        Reminder,
        on_delete=models.CASCADE,
        related_name='recipients',
        verbose_name='提醒事项'
    )
    person = models.ForeignKey(
        'persons.Person',
        on_delete=models.PROTECT,
        related_name='reminder_inbox',
        verbose_name='接收人'
    )
    is_read = models.BooleanField(
        default=False,
        verbose_name='是否已读'
    )
    read_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name='读取时间'
    )

    class Meta:
        db_table = 'reminders_reminder_recipient'
        verbose_name = '提醒接收人'
        verbose_name_plural = '提醒接收人'
        constraints = [
            models.UniqueConstraint(
                fields=['reminder', 'person'],
                condition=models.Q(deleted_at__isnull=True),
                name='uq_rmd_rr_person_not_deleted'
            )
        ]
        indexes = [
            models.Index(fields=['person', 'is_read'], name='idx_rmd_person_read'),
            models.Index(fields=['reminder'], name='idx_rmd_reminder'),
        ]

    def __str__(self):
        return f"Recipient<{self.person_id}> of Reminder<{self.reminder_id}>"

    def mark_read(self, at=None, save=True):
        """
        标记为已读（幂等）：
        - 若已是已读则忽略；
        - 默认记录当前 UTC 时间为读取时间。
        """
        if self.is_read:
            return
        self.is_read = True
        self.read_at = at or timezone.now()
        if save:
            self.save(update_fields=['is_read', 'read_at', 'updated_at', 'updated_by'])


    def compute_e2e_type(self):
        """
        根据发送人与接收人角色计算端到端类别并返回（不保存）。
        多接收人场景：优先取 primary receiver，如为空则取第一个子表接收人。
        """
        sender_letter = self._pick_role_letter(self.sender)
        # 选择接收人来源
        recv_person = self.receiver
        if recv_person is None:
            recv_person = self.recipients.first().person if hasattr(self, 'recipients') else None
        recv_letter = self._pick_role_letter(recv_person) if recv_person else 'O'
        pair = f"{sender_letter}2{recv_letter}"
        mapping = {
            'T2R': EndToEndType.T2R,
            'T2O': EndToEndType.T2O,
            'R2T': EndToEndType.R2T,
            'R2O': EndToEndType.R2O,
            'O2T': EndToEndType.O2T,
            'O2R': EndToEndType.O2R,
            'O2O': EndToEndType.O2O,
        }
        return mapping.get(pair, EndToEndType.O2R)