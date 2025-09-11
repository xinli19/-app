from django.db import models
from django.utils import timezone
from apps.core.models import AuditModel
from apps.core.enums import AnnouncementType

class Announcement(AuditModel):
    """
    公告
    - 由教研发布，面向全体教师（当前版本）
    - 生效时间窗口 [start_at, end_at]，end_at 为空视为仍有效
    - 高频筛选字段建立索引：type、publisher、窗口
    """
    publisher = models.ForeignKey(
        'persons.Person',
        on_delete=models.PROTECT,
        related_name='published_announcements',
        verbose_name='发布人',
        help_text='发布公告的人员（教研）'
    )
    type = models.CharField(
        max_length=64,
        choices=AnnouncementType.choices,
        verbose_name='公告类型'
    )
    content = models.TextField(
        verbose_name='公告内容',
        help_text='公告内容文本（可扩展为富文本存储或富文本渲染）'
    )
    start_at = models.DateTimeField(
        default=timezone.now,
        verbose_name='开始时间',
        help_text='公告开始生效时间（UTC）'
    )
    end_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name='结束时间',
        help_text='公告结束时间（UTC），为空视为仍有效'
    )

    class Meta:
        db_table = 'announcements_announcement'
        verbose_name = '公告'
        verbose_name_plural = '公告'
        indexes = [
            models.Index(fields=['type'], name='idx_ann_type'),
            models.Index(fields=['publisher'], name='idx_ann_publisher'),
            models.Index(fields=['start_at', 'end_at'], name='idx_ann_window'),
        ]

    def __str__(self):
        summary = (self.content or '').strip().replace('\n', ' ')
        if len(summary) > 20:
            summary = summary[:20] + '…'
        return f"[{self.get_type_display()}] {summary}"

    def clean(self):
        super().clean()
        if self.end_at and self.start_at and self.start_at > self.end_at:
            raise ValueError('开始时间不可晚于结束时间')

    def is_active(self, at=None):
        """
        判断公告在给定时间点是否有效
        """
        at = at or timezone.now()
        if self.start_at and at < self.start_at:
            return False
        if self.end_at and at > self.end_at:
            return False
        return True