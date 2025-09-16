#!/usr/bin/env python
"""
测试数据集生成脚本
基于现有课程数据生成完整的测试数据集，包括：
- 人员数据（教师、教研、运营）
- 学员数据
- 课程记录
- 点评任务和反馈记录
- 提醒事项
- 公告
- 回访记录
"""

import os
import sys
import django
import json
import random
from datetime import datetime, timedelta
from django.utils import timezone
from faker import Faker

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_system.settings')
django.setup()

from apps.persons.models import Person, PersonRole
from apps.students.models import Student, StudentTag, CourseRecord
from apps.courses.models import Course, Lesson, Piece, CourseVersion, LessonVersion, PieceVersion
from apps.evaluations.models import EvaluationTask, FeedbackRecord, FeedbackPieceDetail, StudentPieceStatus
from apps.reminders.models import Reminder, ReminderRecipient
from apps.announcements.models import Announcement
from apps.followups.models import FollowUpRecord
from apps.notifications.models import Notification
from apps.core.enums import *
from django.contrib.auth.models import User

# 初始化Faker
fake = Faker('zh_CN')
Faker.seed(42)  # 设置随机种子确保可重复性
random.seed(42)

class TestDataGenerator:
    def __init__(self):
        self.persons = []
        self.students = []
        self.courses = []
        self.course_records = []
        self.evaluation_tasks = []
        self.feedback_records = []
        self.reminders = []
        self.announcements = []
        self.followups = []
        
    def clear_existing_data(self):
        """清除现有测试数据"""
        print("清除现有测试数据...")
        
        # 使用事务和级联删除来处理外键约束
    from django.db import transaction
    
    with transaction.atomic():
        # 按依赖关系顺序删除 - 先删除最依赖的数据
        Notification.objects.all().delete()
        ReminderRecipient.objects.all().delete()
        Reminder.objects.all().delete()
        FollowUpRecord.objects.all().delete()
        Announcement.objects.all().delete()
        StudentPieceStatus.objects.all().delete()
        FeedbackPieceDetail.objects.all().delete()
        FeedbackRecord.objects.all().delete()
        EvaluationTask.objects.all().delete()
        CourseRecord.objects.all().delete()
        
        # 删除版本数据
        PieceVersion.objects.all().delete()
        LessonVersion.objects.all().delete()
        CourseVersion.objects.all().delete()
        
        # 删除课程数据（如果需要重新生成）
        # Piece.objects.all().delete()
        # Lesson.objects.all().delete()
        # Course.objects.all().delete()
        
        # 删除学员相关数据
        Student.objects.all().delete()
        StudentTag.objects.all().delete()
        # 删除人员相关数据
        PersonRole.objects.all().delete()
        Person.objects.all().delete()
        
        print("清除完成")
    
    def load_course_data(self):
        """加载现有课程数据"""
        print("加载课程数据...")
        
        # 检查是否已有课程数据
        if Course.objects.exists():
            print("课程数据已存在，跳过加载")
            self.courses = list(Course.objects.all())
            return
            
        # 从JSON文件加载课程数据
        with open('data/django_course_data.json', 'r', encoding='utf-8') as f:
            course_data = json.load(f)
        
        for course_name, course_info in course_data.items():
            # 创建课程
            course = Course.objects.create(
                name=course_info['course']['name'],
                status=course_info['course']['status'],
                description=course_info['course']['description']
            )
            self.courses.append(course)
            
            # 创建课程版本
            course_version = CourseVersion.objects.create(
                course=course,
                version_label="2024版",
                status=EnableStatus.ENABLED,
                released_at=timezone.now()
            )
            
            # 创建课程
            for lesson_info in course_info['lessons']:
                lesson = Lesson.objects.create(
                    course=course,
                    name=lesson_info['name'],
                    status=lesson_info['status'],
                    sort_order=lesson_info['sort_order'],
                    description=lesson_info['description']
                )
                
                # 创建课程版本
                lesson_version = LessonVersion.objects.create(
                    lesson=lesson,
                    course_version=course_version,
                    sort_order=lesson_info['sort_order'],
                    category=random.choice([LessonCategory.BASIC, LessonCategory.ZERO_BASIC]),
                    focus=random.choice([LessonFocus.WRIST, LessonFocus.ARM, LessonFocus.LIFT_FINGER])
                )
                
                # 创建曲目
                for piece_info in lesson_info['pieces']:
                    piece = Piece.objects.create(
                        course=course,
                        lesson=lesson,
                        name=piece_info['name'],
                        status=piece_info['status'],
                        attribute=piece_info['attribute'],
                        is_required=piece_info['is_required'],
                        description=piece_info['description']
                    )
                    
                    # 创建曲目版本
                    PieceVersion.objects.create(
                        piece=piece,
                        lesson_version=lesson_version,
                        attribute=piece_info['attribute'],
                        is_required=piece_info['is_required']
                    )
        
        print(f"加载了 {len(self.courses)} 个课程")
    
    def generate_persons(self):
        """生成人员数据"""
        print("生成人员数据...")
        
        # 生成教师
        for i in range(8):
            person = Person.objects.create(
                name=fake.name(),
                status=EnableStatus.ENABLED,
                email=fake.email(),
                phone=fake.phone_number()
            )
            PersonRole.objects.create(
                person=person,
                role=RoleType.TEACHER
            )
            self.persons.append(person)
        
        # 生成教研人员
        for i in range(3):
            person = Person.objects.create(
                name=fake.name(),
                status=EnableStatus.ENABLED,
                email=fake.email(),
                phone=fake.phone_number()
            )
            PersonRole.objects.create(
                person=person,
                role=RoleType.RESEARCHER
            )
            self.persons.append(person)
        
        # 生成运营人员
        for i in range(2):
            person = Person.objects.create(
                name=fake.name(),
                status=EnableStatus.ENABLED,
                email=fake.email(),
                phone=fake.phone_number()
            )
            PersonRole.objects.create(
                person=person,
                role=RoleType.OPERATOR
            )
            self.persons.append(person)
        
        print(f"生成了 {len(self.persons)} 个人员")
    
    def generate_student_tags(self):
        """生成学员标签"""
        print("生成学员标签...")
        
        tags = [
            ('优秀学员', '学习态度积极，进步明显'),
            ('需要关注', '学习进度较慢，需要额外关注'),
            ('有天赋', '音乐天赋较好，可重点培养'),
            ('基础薄弱', '音乐基础较差，需要加强基础训练'),
            ('练习积极', '课后练习很认真'),
            ('缺乏练习', '课后练习不够'),
            ('家长配合', '家长很配合教学'),
            ('沟通困难', '与家长沟通存在困难'),
        ]
        
        for name, desc in tags:
            StudentTag.objects.create(name=name, description=desc)
    
    def generate_students(self):
        """生成学员数据"""
        print("生成学员数据...")
        
        tags = list(StudentTag.objects.all())
        
        for i in range(50):
            student = Student.objects.create(
                xiaoetong_id=f"xt_{fake.random_int(100000, 999999)}",
                nickname=fake.name(),
                remark_name=fake.name() if random.random() > 0.7 else None,
                status=EnableStatus.ENABLED,
                teacher_impression_current=fake.text(max_nb_chars=200) if random.random() > 0.5 else None,
                op_note=fake.text(max_nb_chars=150) if random.random() > 0.6 else None,
                created_by=random.choice(self.persons)
            )
            
            # 随机分配标签
            student_tags = random.sample(tags, random.randint(0, 3))
            student.tags.set(student_tags)
            
            self.students.append(student)
        
        print(f"生成了 {len(self.students)} 个学员")
    
    def generate_course_records(self):
        """生成学员课程记录"""
        print("生成课程记录...")
        
        for student in self.students:
            # 每个学员随机分配1-2个课程
            num_courses = random.randint(1, 2)
            selected_courses = random.sample(self.courses, min(num_courses, len(self.courses)))
            
            for course in selected_courses:
                course_version = course.versions.first()
                if not course_version:
                    continue
                    
                start_date = fake.date_time_between(start_date='-6M', end_date='now', tzinfo=timezone.get_current_timezone())
                
                course_record = CourseRecord.objects.create(
                    student=student,
                    course=course,
                    course_version=course_version,
                    course_status=random.choice([CourseLearnStatus.LEARNING, CourseLearnStatus.NOT_STARTED, CourseLearnStatus.FINISHED]),
                    record_status=RecordStatus.ACTIVE,
                    start_at=start_date,
                    end_at=start_date + timedelta(days=random.randint(30, 180)) if random.random() > 0.7 else None,
                    created_by=random.choice(self.persons)
                )
                self.course_records.append(course_record)
        
        print(f"生成了 {len(self.course_records)} 个课程记录")
    
    def generate_evaluation_tasks(self):
        """生成点评任务"""
        print("生成点评任务...")
        
        teachers = [p for p in self.persons if p.roles.filter(role=RoleType.TEACHER).exists()]
        
        for i in range(100):
            student = random.choice(self.students)
            teacher = random.choice(teachers)
            
            task = EvaluationTask.objects.create(
                student=student,
                assignee=teacher,
                status=random.choice([TaskStatus.PENDING, TaskStatus.COMPLETED]),
                source=random.choice([TaskSource.RESEARCHER, TaskSource.TEACHER]),
                note=fake.text(max_nb_chars=100) if random.random() > 0.7 else None,
                created_by=random.choice(self.persons)
            )
            self.evaluation_tasks.append(task)
        
        print(f"生成了 {len(self.evaluation_tasks)} 个点评任务")
    
    def generate_feedback_records(self):
        """生成点评记录"""
        print("生成点评记录...")
        
        completed_tasks = [t for t in self.evaluation_tasks if t.status == TaskStatus.COMPLETED]
        researchers = [p for p in self.persons if p.roles.filter(role=RoleType.RESEARCHER).exists()]
        
        for task in completed_tasks:
            feedback = FeedbackRecord.objects.create(
                task=task,
                student=task.student,
                teacher=task.assignee,
                teacher_content=fake.text(max_nb_chars=500),
                researcher_feedback=fake.text(max_nb_chars=300) if random.random() > 0.5 else None,
                produce_impression=random.random() > 0.6,
                impression_text=fake.text(max_nb_chars=200) if random.random() > 0.7 else None,
                created_by=task.assignee
            )
            
            # 为点评记录添加曲目明细
            student_courses = CourseRecord.objects.filter(student=task.student)
            if student_courses.exists():
                course_record = random.choice(student_courses)
                pieces = Piece.objects.filter(course=course_record.course)[:random.randint(1, 3)]
                
                for piece in pieces:
                    FeedbackPieceDetail.objects.create(
                        feedback=feedback,
                        piece=piece,
                        course_version=course_record.course_version,
                        lesson_version=piece.lesson.versions.filter(course_version=course_record.course_version).first(),
                        created_by=task.assignee
                    )
            
            self.feedback_records.append(feedback)
        
        # 更新学员曲目状态
        for feedback in self.feedback_records:
            StudentPieceStatus.update_by_feedback(feedback)
        
        print(f"生成了 {len(self.feedback_records)} 个点评记录")
    
    def generate_reminders(self):
        """生成提醒事项"""
        print("生成提醒事项...")
        
        operators = [p for p in self.persons if p.roles.filter(role=RoleType.OPERATOR).exists()]
        teachers = [p for p in self.persons if p.roles.filter(role=RoleType.TEACHER).exists()]
        
        for i in range(30):
            student = random.choice(self.students)
            creator = random.choice(self.persons)
            
            reminder = Reminder.objects.create(
                sender=creator,
                receiver=random.choice(operators + teachers),
                student=student,
                content=fake.text(max_nb_chars=300),
                category=random.choice([c[0] for c in ReminderCategory.choices]),
                urgency=random.choice([u[0] for u in UrgencyLevel.choices]),
                e2e_type=random.choice([e[0] for e in EndToEndType.choices]),
                feedback=random.choice(self.feedback_records) if random.random() > 0.7 else None,
                created_by=creator
            )
            
            # 添加接收人
            recipients = random.sample(operators + teachers, random.randint(1, 3))
            for recipient in recipients:
                ReminderRecipient.objects.create(
                    reminder=reminder,
                    person=recipient,
                    created_by=creator
                )
            
            self.reminders.append(reminder)
        
        print(f"生成了 {len(self.reminders)} 个提醒事项")
    
    def generate_announcements(self):
        """生成公告"""
        print("生成公告...")
        
        for i in range(10):
            announcement = Announcement.objects.create(
                publisher=random.choice(self.persons),
                type=random.choice([t[0] for t in AnnouncementType.choices]),
                content=fake.text(max_nb_chars=800),
                start_at=fake.past_datetime(start_date='-30d'),
                end_at=fake.future_datetime(end_date='+30d') if random.random() > 0.3 else None,
                created_by=random.choice(self.persons)
            )
            self.announcements.append(announcement)
        
        print(f"生成了 {len(self.announcements)} 个公告")
    
    def generate_followups(self):
        """生成回访记录"""
        print("生成回访记录...")
        
        operators = [p for p in self.persons if p.roles.filter(role=RoleType.OPERATOR).exists()]
        
        for i in range(40):
            student = random.choice(self.students)
            operator = random.choice(operators)
            
            followup = FollowUpRecord.objects.create(
                student=student,
                operator=operator,
                seq_no=i + 1,
                purpose=random.choice([p[0] for p in FollowUpPurpose.choices]),
                urgency=random.choice([u[0] for u in FollowUpUrgency.choices]),
                status=random.choice([s[0] for s in FollowUpStatus.choices]),
                content=fake.text(max_nb_chars=400),
                result=fake.text(max_nb_chars=200) if random.random() > 0.5 else None,
                need_follow_up=random.choice([True, False]),
                next_follow_up_at=fake.future_datetime(end_date='+30d', tzinfo=timezone.get_current_timezone()) if random.random() > 0.6 else None,
                created_by=operator
            )
            self.followups.append(followup)
        
        print(f"生成了 {len(self.followups)} 个回访记录")
    
    def generate_notifications(self):
        """生成通知"""
        print("生成通知...")
        
        notification_count = 0
        
        # 为每个人员生成一些通知
        for person in self.persons:
            for i in range(random.randint(3, 8)):
                # 随机选择关联对象
                link_type = random.choice([t[0] for t in LinkType.choices])
                link_id = None
                
                # 由于大部分模型使用UUID主键，而link_id是BigIntegerField，暂时设为None
                # 或者可以使用随机整数作为示例
                if random.random() > 0.5:  # 50%概率有关联
                    link_id = random.randint(1, 1000)
                
                Notification.objects.create(
                    recipient=person,
                    type=random.choice([t[0] for t in NotificationType.choices]),
                    title=fake.sentence(nb_words=6),
                    message=fake.text(max_nb_chars=200),
                    sender=random.choice(self.persons),
                    link_type=link_type if link_id else None,
                    link_id=link_id,
                    is_read=random.random() > 0.4
                )
                notification_count += 1
        
        print(f"生成了 {notification_count} 个通知")
    
    def generate_all(self):
        """生成所有测试数据"""
        print("开始生成测试数据集...")
        
        # 清除现有数据
        self.clear_existing_data()
        
        # 按依赖关系顺序生成数据
        self.load_course_data()
        self.generate_persons()
        self.generate_student_tags()
        self.generate_students()
        self.generate_course_records()
        self.generate_evaluation_tasks()
        self.generate_feedback_records()
        self.generate_reminders()
        self.generate_announcements()
        self.generate_followups()
        self.generate_notifications()
        
        print("\n=== 测试数据生成完成 ===")
        print(f"人员: {len(self.persons)}")
        print(f"学员: {len(self.students)}")
        print(f"课程: {len(self.courses)}")
        print(f"课程记录: {len(self.course_records)}")
        print(f"点评任务: {len(self.evaluation_tasks)}")
        print(f"点评记录: {len(self.feedback_records)}")
        print(f"提醒事项: {len(self.reminders)}")
        print(f"公告: {len(self.announcements)}")
        print(f"回访记录: {len(self.followups)}")
        print("通知: 已生成")
        print("\n数据生成完成！可以开始测试系统功能。")

if __name__ == '__main__':
    generator = TestDataGenerator()
    generator.generate_all()