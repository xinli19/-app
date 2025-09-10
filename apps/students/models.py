"""
学生域模型
"""
from django.db import models
from django.core.exceptions import ValidationError
from apps.core.models import BaseModel
from apps.core.enums import EnableStatus
from apps.core.models import AuditModel
from apps.core.enums import CourseLearnStatus, RecordStatus

class StudentTag(BaseModel):
    """
    学员标签（字典 + 自定义）
    """
    name = models.CharField(max_length=64, unique=True, verbose_name='标签名')
    description = models.CharField(max_length=255, null=True, blank=True, verbose_name='描述')

    class Meta:
        db_table = 'students_student_tag'
        verbose_name = '学员标签'
        verbose_name_plural = '学员标签'
        indexes = [
            models.Index(fields=['name'], name='idx_studenttag_name'),
        ]

    def __str__(self):
        return self.name

class Student(BaseModel):
    """
    学员（独立实体，禁止删除，可停用）
    """
    xiaoetong_id = models.CharField(max_length=64, unique=True, verbose_name='小鹅通ID')
    nickname = models.CharField(max_length=100, verbose_name='昵称')
    remark_name = models.CharField(max_length=100, null=True, blank=True, verbose_name='备注名')
    status = models.CharField(
        max_length=20,
        choices=EnableStatus.choices,
        default=EnableStatus.ENABLED,
        verbose_name='状态'
    )
    teacher_impression_current = models.TextField(null=True, blank=True, verbose_name='教师印象（当前）')
    op_note = models.TextField(null=True, blank=True, verbose_name='运营备注')
    tags = models.ManyToManyField(StudentTag, blank=True, related_name='students', verbose_name='标签')

    # 审计（不软删）：指向人员
    created_by = models.ForeignKey(
        'persons.Person', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='student_created', verbose_name='创建者'
    )
    updated_by = models.ForeignKey(
        'persons.Person', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='student_updated', verbose_name='更新者'
    )

    class Meta:
        db_table = 'students_student'
        verbose_name = '学员'
        verbose_name_plural = '学员'
        indexes = [
            models.Index(fields=['xiaoetong_id'], name='idx_student_xiaoetong'),
            models.Index(fields=['nickname'], name='idx_student_nickname'),
            models.Index(fields=['status'], name='idx_student_status'),
        ]

    def __str__(self):
        return f"{self.nickname}({self.xiaoetong_id})"

    def delete(self, using=None, keep_parents=False):
        """
        禁止删除学员
        """
        raise ValidationError('学员不可删除')


class CourseRecord(AuditModel):
    """
    学员课程记录（支持软删，保留历史；允许并行“有效”记录）
    """
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='course_records', verbose_name='学员')
    course = models.ForeignKey('courses.Course', on_delete=models.PROTECT, related_name='course_records', verbose_name='课程')
    course_version = models.ForeignKey('courses.CourseVersion', on_delete=models.PROTECT, related_name='course_records', verbose_name='课程版本')
    course_status = models.CharField(max_length=20, choices=CourseLearnStatus.choices, default=CourseLearnStatus.NOT_STARTED, verbose_name='课程学习状态')
    record_status = models.CharField(max_length=20, choices=RecordStatus.choices, default=RecordStatus.ACTIVE, verbose_name='记录状态')
    start_at = models.DateTimeField(verbose_name='开始时间')
    end_at = models.DateTimeField(null=True, blank=True, verbose_name='结束时间')

    class Meta:
        db_table = 'students_course_record'
        verbose_name = '学员课程记录'
        verbose_name_plural = '学员课程记录'
        indexes = [
            models.Index(fields=['student'], name='idx_cr_student'),
            models.Index(fields=['course'], name='idx_cr_course'),
            models.Index(fields=['course_version'], name='idx_cr_course_ver'),
            models.Index(fields=['record_status'], name='idx_cr_status'),
            models.Index(fields=['start_at', 'end_at'], name='idx_cr_period'),
        ]

    def __str__(self):
        return f"{self.student.nickname} - {self.course.name} ({self.start_at:%Y-%m-%d})"