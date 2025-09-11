from django.db import models, transaction
from django.utils.translation import gettext_lazy as _
from apps.core.models import AuditModel
from apps.core.enums import FollowUpStatus, FollowUpPurpose, FollowUpUrgency


class FollowUpRecord(AuditModel):
    """
    回访记录
    """
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.PROTECT,
        related_name='follow_up_records',
        verbose_name=_('学员'),
    )
    operator = models.ForeignKey(
        'persons.Person',
        on_delete=models.PROTECT,
        related_name='operated_follow_ups',
        verbose_name=_('回访人员'),
    )
    seq_no = models.PositiveIntegerField(verbose_name=_('回访序号'))
    status = models.CharField(
        max_length=20,
        choices=FollowUpStatus.choices,
        default=FollowUpStatus.PENDING,
        verbose_name=_('回访状态'),
    )
    purpose = models.CharField(
        max_length=50,
        choices=FollowUpPurpose.choices,
        default=FollowUpPurpose.REGULAR,
        verbose_name=_('回访目的'),
    )
    urgency = models.CharField(
        max_length=10,
        choices=FollowUpUrgency.choices,
        default=FollowUpUrgency.MEDIUM,
        verbose_name=_('紧急度'),
    )
    content = models.TextField(verbose_name=_('回访内容'))
    result = models.TextField(null=True, blank=True, verbose_name=_('回访结果'))
    need_follow_up = models.BooleanField(default=False, verbose_name=_('是否需要跟进'))
    next_follow_up_at = models.DateTimeField(null=True, blank=True, verbose_name=_('下次回访计划时间'))

    class Meta:
        db_table = 'followups_followup_record'
        verbose_name = '回访记录'
        verbose_name_plural = '回访记录'
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'seq_no'],
                name='uq_fup_seq',
            )
        ]
        indexes = [
            models.Index(fields=['student'], name='idx_fup_student'),
            models.Index(fields=['operator'], name='idx_fup_operator'),
            models.Index(fields=['status'], name='idx_fup_status'),
            models.Index(fields=['urgency'], name='idx_fup_urgency'),
            models.Index(fields=['created_at'], name='idx_fup_created'),
        ]

    def __str__(self):
        return f'FollowUp#{self.id} student={self.student_id} status={self.status}'

    def save(self, *args, **kwargs):
        """
        若未显式提供 seq_no，则为该学员自动生成自增序号（加锁，降低并发冲突）
        """
        if self.seq_no is None:
            if not self.student_id:
                raise ValueError('student must be set before auto generating seq_no')
            with transaction.atomic():
                last = (FollowUpRecord.objects
                        .select_for_update()
                        .filter(student_id=self.student_id)
                        .order_by('-seq_no')
                        .first())
                self.seq_no = (last.seq_no if last else 0) + 1
                return super().save(*args, **kwargs)
        return super().save(*args, **kwargs)