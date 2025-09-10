"""
系统枚举定义
集中管理所有枚举类型
"""
from django.db import models
from django.utils.translation import gettext_lazy as _


class EnableStatus(models.TextChoices):
    """
    启用状态枚举
    """
    ENABLED = 'enabled', _('启用')
    DISABLED = 'disabled', _('停用')


class LessonCategory(models.TextChoices):
    """
    课程分类枚举
    """
    BASIC = 'basic', _('基础版')
    ZERO_BASIC = 'zero_basic', _('零基础版')


class LessonFocus(models.TextChoices):
    """
    课程重点枚举
    """
    WRIST = 'wrist', _('手腕')
    ARM = 'arm', _('手臂')
    LIFT_FINGER = 'lift_finger', _('抬指')


class PieceAttribute(models.TextChoices):
    """
    曲目属性枚举
    """
    ETUDE = 'etude', _('练习曲')
    MUSIC = 'music', _('乐曲')
    TECHNIQUE = 'technique', _('技术练习')


class CourseLearnStatus(models.TextChoices):
    """
    课程学习状态枚举
    """
    NOT_STARTED = 'not_started', _('未开始')
    LEARNING = 'learning', _('学习中')
    FINISHED = 'finished', _('已学完')
    PAUSED = 'paused', _('暂停')
    TRANSFERRED = 'transferred', _('转课')


class RecordStatus(models.TextChoices):
    """
    记录状态枚举
    """
    ACTIVE = 'active', _('有效')
    CLOSED = 'closed', _('已关闭')


class RoleType(models.TextChoices):
    """
    人员角色类型
    """
    TEACHER = 'teacher', _('教师')
    RESEARCHER = 'researcher', _('教研')
    OPERATOR = 'operator', _('运营')