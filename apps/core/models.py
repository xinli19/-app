"""
核心基础模型
包含通用字段和基础模型类
"""
import uuid
from django.db import models
from django.utils import timezone


class BaseModel(models.Model):
    """
    基础模型类，包含通用字段
    所有业务模型都应继承此类
    """
    id = models.UUIDField(
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False,
        verbose_name='主键ID',
        help_text='系统自动生成的唯一标识符'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='创建时间',
        help_text='记录创建的UTC时间'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='更新时间', 
        help_text='记录最后更新的UTC时间'
    )
    
    class Meta:
        abstract = True
        
    def save(self, *args, **kwargs):
        """
        重写保存方法，确保时间字段正确设置
        """
        if not self.created_at:
            self.created_at = timezone.now()
        self.updated_at = timezone.now()
        super().save(*args, **kwargs)


class SoftDeleteModel(BaseModel):
    """
    支持软删除的基础模型
    继承BaseModel并添加软删除功能
    """
    deleted_at = models.DateTimeField(
        null=True, 
        blank=True,
        verbose_name='删除时间',
        help_text='软删除标记时间，为空表示未删除'
    )
    
    class Meta:
        abstract = True
        
    def delete(self, using=None, keep_parents=False):
        """
        重写删除方法，实现软删除
        """
        self.deleted_at = timezone.now()
        self.save(using=using)
        
    def hard_delete(self, using=None, keep_parents=False):
        """
        真正的物理删除方法
        """
        super().delete(using=using, keep_parents=keep_parents)
        
    def restore(self):
        """
        恢复软删除的记录
        """
        self.deleted_at = None
        self.save()
        
    @property
    def is_deleted(self):
        """
        检查记录是否已被软删除
        """
        return self.deleted_at is not None


class AuditModel(SoftDeleteModel):
    """
    包含审计字段的基础模型
    继承SoftDeleteModel并添加创建者和更新者字段
    """
    created_by = models.ForeignKey(
        'persons.Person',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_created',
        verbose_name='创建者',
        help_text='创建此记录的人员'
    )
    
    updated_by = models.ForeignKey(
        'persons.Person',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_updated',
        verbose_name='更新者',
        help_text='最后更新此记录的人员'
    )
    
    class Meta:
        abstract = True