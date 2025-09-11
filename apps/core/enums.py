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


class TaskStatus(models.TextChoices):
    """
    点评任务状态
    """
    PENDING = 'pending', _('未完成')
    COMPLETED = 'completed', _('已完成')


class TaskSource(models.TextChoices):
    """
    点评任务来源
    """
    RESEARCHER = 'researcher', _('教研')
    TEACHER = 'teacher', _('教师')


class UrgencyLevel(models.TextChoices):
    """
    提醒事项紧急度
    """
    URGENT = 'urgent', _('紧急需处理')
    NORMAL = 'normal', _('不紧急需留意')

class ReminderCategory(models.TextChoices):
    """
    提醒事项分类（示例集合，可按需要扩展）
    """
    POOR_EFFECT = 'poor_effect', _('教学效果差')
    ATTITUDE = 'attitude', _('学员态度问题')
    INJURY = 'injury', _('有伤病')
    OTHER = 'other', _('其他')

class EndToEndType(models.TextChoices):
    """
    端到端类别（系统根据发送人与接收人角色推断）
    取值集合：T→R/T→O/R→T/R→O/O→T/O→R/O→O
    """
    T2R = 'T2R', _('T→R')
    T2O = 'T2O', _('T→O')
    R2T = 'R2T', _('R→T')
    R2O = 'R2O', _('R→O')
    O2T = 'O2T', _('O→T')
    O2R = 'O2R', _('O→R')
    O2O = 'O2O', _('O→O')


class AnnouncementType(models.TextChoices):
    INJURY_NOTICE = 'injury_notice', '学员伤病'
    TEACHING_REMINDER = 'teaching_reminder', '教学提醒'

class FollowUpStatus(models.TextChoices):
    """
    回访状态
    """
    PENDING = 'pending', _('未处理')
    DONE = 'done', _('已处理')
    CLOSED = 'closed', _('关闭')

class FollowUpPurpose(models.TextChoices):
    """
    回访目的
    """
    REGULAR = 'regular', _('常规回访')
    ISSUE_TRACKING = 'issue_tracking', _('问题跟进')
    RENEWAL_REMINDER = 'renewal_reminder', _('续费提醒')
    COMPLAINT_HANDLING = 'complaint_handling', _('投诉处理')
    OTHER = 'other', _('其他')

class FollowUpUrgency(models.TextChoices):
    """
    回访紧急度（高/中/低）
    """
    HIGH = 'high', _('高')
    MEDIUM = 'medium', _('中')
    LOW = 'low', _('低')


class NotificationType(models.TextChoices):
    """
    系统通知类型
    """
    TASK_ASSIGNED = 'task_assigned', _('任务分配')
    TASK_COMPLETED = 'task_completed', _('任务完成')
    REMINDER_RECEIVED = 'reminder_received', _('收到提醒')
    FOLLOW_UP_TODO = 'follow_up_todo', _('回访待办')
    ANNOUNCEMENT_PUBLISHED = 'announcement_published', _('公告发布')

class LinkType(models.TextChoices):
    """
    通知关联对象类型
    """
    EVALUATION_TASK = 'evaluation_task', _('点评任务')
    FEEDBACK_RECORD = 'feedback_record', _('点评记录')
    REMINDER = 'reminder', _('提醒事项')
    ANNOUNCEMENT = 'announcement', _('公告')
    FOLLOW_UP = 'follow_up', _('回访记录')
    STUDENT = 'student', _('学员')