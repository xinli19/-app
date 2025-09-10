"""
课程系统模型定义
包含Course（课程）、Lesson（课）、Piece（曲目）等核心模型
严格按照需求文档实体字段设计实现
"""
from django.db import models
from django.core.validators import MinValueValidator
from django.utils.translation import gettext_lazy as _
from apps.core.models import AuditModel, SoftDeleteModel
from apps.core.enums import EnableStatus, LessonCategory, LessonFocus, PieceAttribute


class Course(AuditModel):
    """
    课程模型
    代表课程分类，如基础班、中级班等
    
    字段说明：
    - name: 课程名称，如"基础班"、"中级班"
    - status: 课程状态，启用或停用
    - description: 课程内容描述
    """
    
    name = models.CharField(
        max_length=100,
        verbose_name='课程名称',
        help_text='课程的名称，如基础班、中级班等'
    )
    
    status = models.CharField(
        max_length=20,
        choices=EnableStatus.choices,
        default=EnableStatus.ENABLED,
        verbose_name='课程状态',
        help_text='课程的启用状态'
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='课程描述',
        help_text='对课程的详细描述'
    )
    
    class Meta:
        db_table = 'courses_course'
        verbose_name = '课程'
        verbose_name_plural = '课程'
        constraints = [
            models.UniqueConstraint(
                fields=['name'],
                condition=models.Q(deleted_at__isnull=True),
                name='uq_course_name_not_deleted'
            )
        ]
        indexes = [
            models.Index(fields=['status'], name='idx_course_status'),
            models.Index(fields=['name'], name='idx_course_name'),
            models.Index(fields=['created_at'], name='idx_course_created'),
        ]
    
    def __str__(self):
        """
        返回课程的字符串表示
        """
        return f"{self.name}({self.get_status_display()})"
    
    def get_lesson_count(self):
        """
        获取课程下的课程数量
        
        Returns:
            int: 有效课程的数量
        """
        return self.lessons.filter(
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED
        ).count()
    
    def get_piece_count(self):
        """
        获取课程下的曲目总数
        
        Returns:
            int: 有效曲目的数量
        """
        return Piece.objects.filter(
            course=self,
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED
        ).count()
    
    def get_required_piece_count(self):
        """
        获取课程下的必修曲目数量
        
        Returns:
            int: 必修曲目的数量
        """
        return Piece.objects.filter(
            course=self,
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED,
            is_required=True
        ).count()
    
    def is_active(self):
        """
        检查课程是否处于活跃状态
        
        Returns:
            bool: 课程是否启用且未被软删除
        """
        return self.status == EnableStatus.ENABLED and not self.is_deleted
    
    def get_lessons_by_category(self, category):
        """
        根据分类获取课程列表
        
        Args:
            category (str): 课程分类
            
        Returns:
            QuerySet: 指定分类的课程查询集
        """
        return self.lessons.filter(
            category=category,
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED
        ).order_by('sort_order')


class Lesson(AuditModel):
    """
    课模型
    代表课程下的具体课程，如基础班第1课、第2课等
    
    字段说明：
    - course: 所属课程的外键关联
    - name: 课程名称
    - status: 课程状态
    - sort_order: 课程排序，用于确定课程顺序
    - description: 课程内容描述
    """
    
    course = models.ForeignKey(
        Course,
        on_delete=models.PROTECT,
        related_name='lessons',
        verbose_name='所属课程',
        help_text='该课所属的课程'
    )
    
    name = models.CharField(
        max_length=100,
        verbose_name='课程名称',
        help_text='课程的名称，如第1课、第2课等'
    )
    
    status = models.CharField(
        max_length=20,
        choices=EnableStatus.choices,
        default=EnableStatus.ENABLED,
        verbose_name='课程状态',
        help_text='课程的启用状态'
    )
    
    sort_order = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='排序序号',
        help_text='课程在所属课程中的排序序号，从1开始'
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='课程描述',
        help_text='对课程的详细描述'
    )
    
    class Meta:
        db_table = 'courses_lesson'
        verbose_name = '课'
        verbose_name_plural = '课'
        constraints = [
            models.UniqueConstraint(
                fields=['course', 'sort_order'],
                condition=models.Q(deleted_at__isnull=True),
                name='uq_lesson_course_sort_not_deleted'
            )
        ]
        indexes = [
            models.Index(fields=['course'], name='idx_lesson_course'),
            models.Index(fields=['status'], name='idx_lesson_status'),
            models.Index(fields=['sort_order'], name='idx_lesson_sort'),
        ]
        ordering = ['course', 'sort_order']
    
    def __str__(self):
        """
        返回课程的字符串表示
        """
        return f"{self.course.name} - {self.name}"
    
    def get_piece_count(self):
        """
        获取该课下的曲目数量
        
        Returns:
            int: 有效曲目的数量
        """
        return self.pieces.filter(
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED
        ).count()
    
    def get_required_piece_count(self):
        """
        获取该课下的必修曲目数量
        
        Returns:
            int: 必修曲目的数量
        """
        return self.pieces.filter(
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED,
            is_required=True
        ).count()
    
    def get_pieces_by_attribute(self, attribute):
        """
        根据曲目属性获取曲目列表
        
        Args:
            attribute (str): 曲目属性
            
        Returns:
            QuerySet: 指定属性的曲目查询集
        """
        return self.pieces.filter(
            attribute=attribute,
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED
        )
    
    def is_active(self):
        """
        检查课程是否处于活跃状态
        
        Returns:
            bool: 课程是否启用且未被软删除，且所属课程也是活跃的
        """
        return (
            self.status == EnableStatus.ENABLED and 
            not self.is_deleted and 
            self.course.is_active()
        )
    
    def get_next_lesson(self):
        """
        获取下一课
        
        Returns:
            Lesson or None: 下一课对象，如果没有则返回None
        """
        return Lesson.objects.filter(
            course=self.course,
            sort_order__gt=self.sort_order,
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED
        ).order_by('sort_order').first()
    
    def get_previous_lesson(self):
        """
        获取上一课
        
        Returns:
            Lesson or None: 上一课对象，如果没有则返回None
        """
        return Lesson.objects.filter(
            course=self.course,
            sort_order__lt=self.sort_order,
            deleted_at__isnull=True,
            status=EnableStatus.ENABLED
        ).order_by('-sort_order').first()


class Piece(AuditModel):
    """
    曲目模型
    代表课程下的细分学习内容
    
    字段说明：
    - course: 所属课程的外键关联（通过课间接关联）
    - lesson: 所属课的外键关联
    - name: 曲目名称
    - status: 曲目状态
    - attribute: 曲目属性，如练习曲、乐曲、技术练习
    - is_required: 是否为必修曲目
    - description: 曲目内容描述
    """
    
    course = models.ForeignKey(
        Course,
        on_delete=models.PROTECT,
        related_name='pieces',
        verbose_name='所属课程',
        help_text='该曲目所属的课程（通过课间接关联）'
    )
    
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.PROTECT,
        related_name='pieces',
        verbose_name='所属课',
        help_text='该曲目所属的具体课程'
    )
    
    name = models.CharField(
        max_length=150,
        verbose_name='曲目名称',
        help_text='曲目的名称'
    )
    
    status = models.CharField(
        max_length=20,
        choices=EnableStatus.choices,
        default=EnableStatus.ENABLED,
        verbose_name='曲目状态',
        help_text='曲目的启用状态'
    )
    
    attribute = models.CharField(
        max_length=20,
        choices=PieceAttribute.choices,
        verbose_name='曲目属性',
        help_text='曲目的属性类型，如练习曲、乐曲、技术练习'
    )
    
    is_required = models.BooleanField(
        default=True,
        verbose_name='是否必修',
        help_text='该曲目是否为必修内容'
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='曲目描述',
        help_text='对曲目的详细描述'
    )
    
    class Meta:
        db_table = 'courses_piece'
        verbose_name = '曲目'
        verbose_name_plural = '曲目'
        constraints = [
            models.UniqueConstraint(
                fields=['lesson', 'name'],
                condition=models.Q(deleted_at__isnull=True),
                name='uq_piece_lesson_name_not_deleted'
            )
        ]
        indexes = [
            models.Index(fields=['lesson'], name='idx_piece_lesson'),
            models.Index(fields=['course'], name='idx_piece_course'),
            models.Index(fields=['status'], name='idx_piece_status'),
            models.Index(fields=['attribute'], name='idx_piece_attribute'),
            models.Index(fields=['is_required'], name='idx_piece_required'),
        ]
        ordering = ['course', 'lesson__sort_order', 'name']
    
    def __str__(self):
        """
        返回曲目的字符串表示
        """
        return f"{self.lesson} - {self.name}"
    
    def save(self, *args, **kwargs):
        """
        重写保存方法，确保course字段与lesson.course保持一致
        """
        if self.lesson_id:
            # 确保曲目的course与其lesson的course一致
            self.course = self.lesson.course
        super().save(*args, **kwargs)
    
    def is_active(self):
        """
        检查曲目是否处于活跃状态
        
        Returns:
            bool: 曲目是否启用且未被软删除，且所属课和课程也是活跃的
        """
        return (
            self.status == EnableStatus.ENABLED and 
            not self.is_deleted and 
            self.lesson.is_active()
        )
    
    def get_attribute_display_with_required(self):
        """
        获取包含必修信息的属性显示
        
        Returns:
            str: 格式化的属性显示，如"练习曲(必修)"或"乐曲(选修)"
        """
        attribute_display = self.get_attribute_display()
        required_display = "必修" if self.is_required else "选修"
        return f"{attribute_display}({required_display})"
    
    def get_full_path(self):
        """
        获取曲目的完整路径
        
        Returns:
            str: 完整路径，如"基础班 > 第1课 > 曲目名称"
        """
        return f"{self.course.name} > {self.lesson.name} > {self.name}"
    
    def clean(self):
        """
        模型验证方法
        确保曲目的course与lesson.course一致
        """
        from django.core.exceptions import ValidationError
        
        if self.lesson_id and self.course_id:
            if self.course_id != self.lesson.course_id:
                raise ValidationError({
                    'course': '曲目所属课程必须与课所属课程一致'
                })


class CourseVersion(AuditModel):
    """
    课程版本模型
    用于课程版本冻结和历史回查
    
    字段说明：
    - course: 关联的课程
    - version_label: 版本标签，如"2024版"
    - status: 版本状态
    - released_at: 发布时间
    - content_snapshot: 内容快照（JSON格式存储）
    """
    
    course = models.ForeignKey(
        Course,
        on_delete=models.PROTECT,
        related_name='versions',
        verbose_name='关联课程',
        help_text='该版本所属的课程'
    )
    
    version_label = models.CharField(
        max_length=64,
        verbose_name='版本标签',
        help_text='版本的标识标签，如2024版'
    )
    
    status = models.CharField(
        max_length=20,
        choices=EnableStatus.choices,
        default=EnableStatus.ENABLED,
        verbose_name='版本状态',
        help_text='版本的启用状态'
    )
    
    released_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='发布时间',
        help_text='版本的正式发布时间'
    )
    
    content_snapshot = models.TextField(
        null=True,
        blank=True,
        verbose_name='内容快照',
        help_text='版本内容的JSON快照，用于历史回查'
    )
    
    class Meta:
        db_table = 'courses_course_version'
        verbose_name = '课程版本'
        verbose_name_plural = '课程版本'
        constraints = [
            models.UniqueConstraint(
                fields=['course', 'version_label'],
                condition=models.Q(deleted_at__isnull=True),
                name='uq_course_version_not_deleted'
            )
        ]
        indexes = [
            models.Index(fields=['course'], name='idx_course_version_course'),
            models.Index(fields=['version_label'], name='idx_course_version_label'),
            models.Index(fields=['status'], name='idx_course_version_status'),
            models.Index(fields=['released_at'], name='idx_course_version_released'),
        ]
        ordering = ['-released_at', '-created_at']
    
    def __str__(self):
        """
        返回课程版本的字符串表示
        """
        return f"{self.course.name} - {self.version_label}"
    
    def is_released(self):
        """
        检查版本是否已发布
        
        Returns:
            bool: 版本是否已发布
        """
        return self.released_at is not None
    
    def release(self):
        """
        发布版本
        设置发布时间并生成内容快照
        """
        from django.utils import timezone
        import json
        
        if not self.is_released():
            self.released_at = timezone.now()
            # 生成内容快照
            self.content_snapshot = self._generate_content_snapshot()
            self.save()
    
    def _generate_content_snapshot(self):
        """
        生成版本内容快照（JSON结构），用于历史回查
        按最小化文档要求，不包含 Lesson 的 category、focus（它们在 LessonVersion 中）
        """
        data = {
            'course': {
                'id': str(self.course.id),
                'name': self.course.name,
                'status': self.course.status,
                'description': self.course.description,
            },
            'lessons': []
        }
        lessons = Lesson.objects.filter(course=self.course, deleted_at__isnull=True).order_by('sort_order')
        for lesson in lessons:
            lesson_entry = {
                'id': str(lesson.id),
                'name': lesson.name,
                'sort_order': lesson.sort_order,
                'description': lesson.description,
                'pieces': []
            }
            pieces = Piece.objects.filter(lesson=lesson, deleted_at__isnull=True).order_by('name')
            for piece in pieces:
                lesson_entry['pieces'].append({
                    'id': str(piece.id),
                    'name': piece.name,
                    'attribute': piece.attribute,
                    'is_required': piece.is_required,
                    'description': piece.description
                })
            data['lessons'].append(lesson_entry)
        return data


class LessonVersion(AuditModel):
    """
    课版本模型
    记录特定课程版本下的课信息
    
    字段说明：
    - lesson: 关联的课
    - course_version: 关联的课程版本
    - sort_order: 在版本中的排序
    - category: 课分类
    - focus: 课重点
    - description: 课描述
    """
    
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.PROTECT,
        related_name='versions',
        verbose_name='关联课',
        help_text='该版本记录对应的课'
    )
    
    course_version = models.ForeignKey(
        CourseVersion,
        on_delete=models.PROTECT,
        related_name='lesson_versions',
        verbose_name='课程版本',
        help_text='所属的课程版本'
    )
    
    sort_order = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='版本内排序',
        help_text='在该课程版本中的排序序号'
    )
    
    category = models.CharField(
        max_length=20,
        choices=LessonCategory.choices,
        blank=True,
        null=True,
        verbose_name='课分类',
        help_text='在该版本中的课分类'
    )
    
    focus = models.CharField(
        max_length=20,
        choices=LessonFocus.choices,
        blank=True,
        null=True,
        verbose_name='课重点',
        help_text='在该版本中的课重点'
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='版本描述',
        help_text='在该版本中的课描述'
    )
    
    class Meta:
        db_table = 'courses_lesson_version'
        verbose_name = '课版本'
        verbose_name_plural = '课版本'
        constraints = [
            models.UniqueConstraint(
                fields=['lesson', 'course_version'],
                condition=models.Q(deleted_at__isnull=True),
                name='uq_lesson_version_not_deleted'
            )
        ]
        indexes = [
            models.Index(fields=['course_version'], name='idx_lesson_version_course_ver'),
            models.Index(fields=['lesson'], name='idx_lesson_version_lesson'),
            models.Index(fields=['sort_order'], name='idx_lesson_version_sort'),
        ]
        ordering = ['course_version', 'sort_order']
    
    def __str__(self):
        """
        返回课版本的字符串表示
        """
        return f"{self.course_version} - {self.lesson.name}"


class PieceVersion(AuditModel):
    """
    曲目版本模型
    记录特定课版本下的曲目信息
    
    字段说明：
    - piece: 关联的曲目
    - lesson_version: 关联的课版本
    - attribute: 曲目属性
    - is_required: 是否必修
    - description: 曲目描述
    """
    
    piece = models.ForeignKey(
        Piece,
        on_delete=models.PROTECT,
        related_name='versions',
        verbose_name='关联曲目',
        help_text='该版本记录对应的曲目'
    )
    
    lesson_version = models.ForeignKey(
        LessonVersion,
        on_delete=models.PROTECT,
        related_name='piece_versions',
        verbose_name='课版本',
        help_text='所属的课版本'
    )
    
    attribute = models.CharField(
        max_length=20,
        choices=PieceAttribute.choices,
        verbose_name='版本内属性',
        help_text='在该版本中的曲目属性'
    )
    
    is_required = models.BooleanField(
        default=True,
        verbose_name='版本内是否必修',
        help_text='在该版本中是否为必修曲目'
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='版本描述',
        help_text='在该版本中的曲目描述'
    )
    
    class Meta:
        db_table = 'courses_piece_version'
        verbose_name = '曲目版本'
        verbose_name_plural = '曲目版本'
        constraints = [
            models.UniqueConstraint(
                fields=['piece', 'lesson_version'],
                condition=models.Q(deleted_at__isnull=True),
                name='uq_piece_version_not_deleted'
            )
        ]
        indexes = [
            models.Index(fields=['lesson_version'], name='idx_piece_version_lesson_ver'),
            models.Index(fields=['piece'], name='idx_piece_version_piece'),
            models.Index(fields=['attribute'], name='idx_piece_version_attribute'),
            models.Index(fields=['is_required'], name='idx_piece_version_required'),
        ]
        ordering = ['lesson_version', 'piece__name']
    
    def __str__(self):
        """
        返回曲目版本的字符串表示
        """
        return f"{self.lesson_version} - {self.piece.name}"
    
    def get_course_version(self):
        """
        获取所属的课程版本
        
        Returns:
            CourseVersion: 所属的课程版本
        """
        return self.lesson_version.course_version