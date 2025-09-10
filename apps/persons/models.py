"""
人员核心模型（最小化）
"""
from django.db import models
from apps.core.models import BaseModel
from apps.core.enums import EnableStatus

class Person(BaseModel):
    """
    人员（最小化字段）
    - 人员ID: UUID（继承 BaseModel.id）
    - 姓名: name
    - 状态: status
    - 邮箱: email（可选）
    - 电话: phone（可选）
    """
    name = models.CharField(max_length=100, verbose_name='姓名')
    status = models.CharField(
        max_length=20,
        choices=EnableStatus.choices,
        default=EnableStatus.ENABLED,
        verbose_name='状态'
    )
    email = models.CharField(max_length=200, null=True, blank=True, verbose_name='邮箱')
    phone = models.CharField(max_length=50, null=True, blank=True, verbose_name='电话')

    class Meta:
        db_table = 'persons_person'
        verbose_name = '人员'
        verbose_name_plural = '人员'
        indexes = [
            models.Index(fields=['status'], name='idx_person_status'),
        ]

    def __str__(self):
        return self.name

from apps.core.enums import RoleType

class PersonRole(BaseModel):
    """
    人员-角色关系（人员可多角色）
    唯一约束：(person, role)
    """
    person = models.ForeignKey('persons.Person', on_delete=models.CASCADE, related_name='roles', verbose_name='人员')
    role = models.CharField(max_length=20, choices=RoleType.choices, verbose_name='角色')

    class Meta:
        db_table = 'persons_person_role'
        verbose_name = '人员角色'
        verbose_name_plural = '人员角色'
        constraints = [
            models.UniqueConstraint(fields=['person', 'role'], name='uq_person_role'),
        ]
        indexes = [
            models.Index(fields=['person'], name='idx_personrole_person'),
            models.Index(fields=['role'], name='idx_personrole_role'),
        ]

    def __str__(self):
        return f"{self.person.name} - {self.get_role_display()}"
