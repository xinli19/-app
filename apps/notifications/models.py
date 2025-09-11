from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import AuditModel
from apps.core.enums import NotificationType, LinkType


class Notification(AuditModel):
    """
    系统通知
    """
    type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        verbose_name=_('通知类型'),
    )
    title = models.CharField(max_length=200, null=True, blank=True, verbose_name=_('标题'))
    message = models.TextField(verbose_name=_('内容'))

    recipient = models.ForeignKey(
        'persons.Person',
        on_delete=models.PROTECT,
        related_name='notifications',
        verbose_name=_('接收人'),
    )
    sender = models.ForeignKey(
        'persons.Person',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sent_notifications',
        verbose_name=_('发送人'),
    )

    is_read = models.BooleanField(default=False, verbose_name=_('是否已读'))
    read_at = models.DateTimeField(null=True, blank=True, verbose_name=_('阅读时间'))

    link_type = models.CharField(
        max_length=50,
        choices=LinkType.choices,
        null=True, blank=True,
        verbose_name=_('关联对象类型'),
    )
    link_id = models.BigIntegerField(null=True, blank=True, verbose_name=_('关联对象ID'))

    class Meta:
        db_table = 'notifications_notification'
        verbose_name = '系统通知'
        verbose_name_plural = '系统通知'
        constraints = [
            models.CheckConstraint(
                name='ck_notif_link_pair_coherence',
                check=(
                    models.Q(link_type__isnull=True, link_id__isnull=True)
                    | models.Q(link_type__isnull=False, link_id__isnull=False)
                )
            )
        ]
        indexes = [
            models.Index(fields=['recipient', 'is_read'], name='idx_ntf_recipient_read'),
            models.Index(fields=['recipient', 'created_at'], name='idx_ntf_recipient_created'),
            models.Index(fields=['type'], name='idx_ntf_type'),
            models.Index(fields=['link_type', 'link_id'], name='idx_ntf_link'),
        ]

    def __str__(self):
        return f'Notification#{self.id} to={self.recipient_id} type={self.type}'