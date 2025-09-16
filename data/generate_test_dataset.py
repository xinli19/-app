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
        
        # 生成教师 - 使用真实姓名
        teacher_names = ['李老师', '黄老师', '王老师', '钟老师']
        for name in teacher_names:
            person = Person.objects.create(
                name=name,
                status=EnableStatus.ENABLED,
                email=f"{name.replace('老师', '')}@piano-school.com",
                phone=f"138{fake.random_int(min=10000000, max=99999999)}"
            )
            # 创建用户账户
            user = User.objects.create_user(
                username=f"{name}_teacher",
                password='123456',
                email=person.email
            )
            person.user = user
            person.save()
            
            PersonRole.objects.create(
                person=person,
                role=RoleType.TEACHER
            )
            self.persons.append(person)
        
        # 生成教研人员 - 王老师
        person = Person.objects.create(
            name='王老师',
            status=EnableStatus.ENABLED,
            email='wang@piano-school.com',
            phone=f"139{fake.random_int(min=10000000, max=99999999)}"
        )
        user = User.objects.create_user(
            username='王老师_researcher',
            password='123456',
            email=person.email
        )
        person.user = user
        person.save()
        
        PersonRole.objects.create(
            person=person,
            role=RoleType.RESEARCHER
        )
        self.persons.append(person)
        
        # 生成运营人员 - 杜老师
        person = Person.objects.create(
            name='杜老师',
            status=EnableStatus.ENABLED,
            email='du@piano-school.com',
            phone=f"137{fake.random_int(min=10000000, max=99999999)}"
        )
        user = User.objects.create_user(
            username='杜老师_operator',
            password='123456',
            email=person.email
        )
        person.user = user
        person.save()
        
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
        
        # 成人钢琴学员的真实姓名
        student_names = [
            '张雅琴', '李明华', '王美丽', '陈志强', '刘晓敏', '赵文博', '孙丽娜', '周建国',
            '吴雅芳', '郑海燕', '马晓东', '朱丽华', '胡建军', '林雅静', '何志明', '罗美玲',
            '高文华', '梁晓红', '谢志勇', '韩雅琴', '曹明亮', '邓丽萍', '彭志华', '苏雅文',
            '蒋晓明', '卢美华', '姚志强', '钟雅琴', '谭文博', '石丽娜', '龙建国', '叶雅芳',
            '程海燕', '董晓东', '薛丽华', '范建军', '邹雅静', '汪志明', '江美玲', '尹文华',
            '黎晓红', '易志勇', '常雅琴', '武明亮', '乔丽萍', '贺志华', '毛雅文', '段晓明',
            '雷美华', '方志强'
        ]
        
        for i, name in enumerate(student_names):
            student = Student.objects.create(
                xiaoetong_id=f"xt_{fake.random_int(100000, 999999)}",
                nickname=name,
                remark_name=name if random.random() > 0.8 else None,
                status=EnableStatus.ENABLED,
                teacher_impression_current=random.choice([
                    '学习态度认真，基础扎实',
                    '进步很快，有音乐天赋',
                    '需要加强基本功练习',
                    '对音乐理解力较好',
                    '练习时间需要增加',
                    '手型需要进一步调整',
                    '节奏感较好，表现力不错'
                ]) if random.random() > 0.4 else None,
                op_note=random.choice([
                    '工作较忙，上课时间需要灵活安排',
                    '学习目标明确，希望能演奏经典曲目',
                    '零基础学员，需要耐心引导',
                    '有一定基础，可以适当加快进度',
                    '对流行音乐比较感兴趣',
                    '希望参加学校的音乐会演出'
                ]) if random.random() > 0.5 else None,
                created_by=random.choice(self.persons)
            )
            
            # 随机分配标签
            student_tags = random.sample(tags, random.randint(0, 2))
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
        
        # 成人钢琴教育的点评任务内容
        task_notes = [
            "基础手型练习点评 - 请学员录制基本手型和音阶练习视频，重点关注手指独立性和手腕放松程度",
            "《小星星》演奏点评 - 学员演奏《小星星》变奏曲，请注意节奏的准确性和音色的控制",
            "和弦连接练习点评 - C大调基本和弦连接练习，重点评价和弦转换的流畅性和声音的连贯性",
            "《致爱丽丝》片段点评 - 贝多芬《致爱丽丝》前16小节演奏，关注旋律线条的表现和踏板的使用",
            "流行歌曲弹唱点评 - 学员自选流行歌曲进行弹唱，评价伴奏与演唱的协调性和整体表现力",
            "音阶技巧练习点评 - C大调、G大调音阶练习，重点关注指法的正确性和速度的均匀性",
            "《卡农》简化版点评 - 帕赫贝尔《卡农》简化版演奏，注意左右手的配合和音乐的层次感",
            "即兴伴奏练习点评 - 为指定旋律配简单伴奏，评价和声选择的合理性和伴奏织体的适用性",
            "踏板技巧练习点评 - 基础踏板使用练习，重点关注踏板与手指配合的时机和效果",
            "视奏能力测试点评 - 简单乐谱视奏练习，评价读谱准确性和演奏流畅度"
        ]
        
        for i in range(80):  # 减少到80个任务
            student = random.choice(self.students)
            teacher = random.choice(teachers)
            
            task = EvaluationTask.objects.create(
                student=student,
                assignee=teacher,
                status=random.choice([TaskStatus.PENDING, TaskStatus.COMPLETED]),
                source=random.choice([TaskSource.RESEARCHER, TaskSource.TEACHER]),
                note=random.choice(task_notes),
                created_by=random.choice(self.persons)
            )
            self.evaluation_tasks.append(task)
        
        print(f"生成了 {len(self.evaluation_tasks)} 个点评任务")
    
    def generate_feedback_records(self):
        """生成点评记录"""
        print("生成点评记录...")
        
        completed_tasks = [t for t in self.evaluation_tasks if t.status == TaskStatus.COMPLETED]
        researchers = [p for p in self.persons if p.roles.filter(role=RoleType.RESEARCHER).exists()]
        
        # 成人钢琴教育的点评评语
        positive_comments = [
            "手型保持得很好，手指独立性有明显提高，继续保持这种练习状态。",
            "节奏把握准确，音色控制有进步，可以尝试更多的表情变化。",
            "和弦转换比上次流畅了很多，左右手配合也更加协调了。",
            "旋律线条表现得很好，音乐感觉不错，踏板使用也比较合理。",
            "弹唱配合得很好，伴奏简洁明了，整体表现力有提升。",
            "指法运用正确，速度控制得当，基本功扎实。",
            "音乐层次感表现得不错，左右手声部平衡处理得很好。",
            "即兴伴奏思路清晰，和声选择合理，有一定的音乐创造力。"
        ]
        
        improvement_comments = [
            "手腕还需要更加放松，注意手指的独立性练习，可以多做一些手指操。",
            "节奏稍有不稳，建议使用节拍器练习，注意强弱拍的区别。",
            "和弦转换时手指准备要提前，避免出现断音，多练习慢速连接。",
            "踏板使用时机需要调整，注意清洁踏板的概念，避免声音混浊。",
            "弹唱时注意伴奏不要过于复杂，重点突出旋律线条。",
            "音阶练习时注意手指的均匀性，避免重音不当，保持连贯性。",
            "注意音乐的呼吸感，乐句之间要有适当的停顿和连接。",
            "即兴伴奏可以尝试更多的织体变化，丰富音乐的表现力。"
        ]
        
        researcher_feedback_templates = [
            "教学方法得当，学员进步明显，建议继续加强基础练习。",
            "点评详细到位，对学员的问题分析准确，教学效果良好。",
            "能够针对成人学员的特点进行教学，耐心细致，值得肯定。",
            "教学重点突出，对学员的鼓励和建议都很中肯。",
            "注重培养学员的音乐感觉，教学理念先进。"
        ]
        
        for task in completed_tasks:
            # 生成符合成人钢琴教育的点评内容
            teacher_content = random.choice(positive_comments) + " " + random.choice(improvement_comments)
            
            feedback = FeedbackRecord.objects.create(
                task=task,
                student=task.student,
                teacher=task.assignee,
                teacher_content=teacher_content,
                researcher_feedback=random.choice(researcher_feedback_templates) if random.random() > 0.5 else None,
                produce_impression=random.random() > 0.6,
                impression_text=random.choice([
                    "学习态度认真，进步稳定",
                    "音乐理解力较好，有一定天赋",
                    "基础扎实，可以适当提高难度",
                    "需要加强练习时间，巩固基本功",
                    "表现力不错，可以尝试更多曲目"
                ]) if random.random() > 0.7 else None,
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
        
        # 成人钢琴教育的提醒事项内容
        reminder_contents = [
            "请关注学员张雅琴的练习进度，最近几次课程表现有所下滑，建议加强基础练习指导。",
            "李明华学员反馈工作较忙，希望调整上课时间，请协调安排合适的时间段。",
            "王美丽学员对流行音乐很感兴趣，建议在教学中适当加入一些流行歌曲的改编版本。",
            "陈志强学员手型问题需要重点关注，建议增加手型纠正的专项练习时间。",
            "刘晓敏学员进步很快，可以考虑适当提高教学难度，增加一些技巧性练习。",
            "赵文博学员缺乏练习时间，需要与其沟通制定合理的练习计划和时间安排。",
            "孙丽娜学员对古典音乐理解力较好，建议重点培养其音乐表现力和情感表达。",
            "周建国学员年龄较大，学习进度相对较慢，需要更多耐心和鼓励。",
            "吴雅芳学员希望参加学校音乐会，请评估其演奏水平并推荐合适的曲目。",
            "郑海燕学员踏板使用不够熟练，建议加强踏板技巧的专项训练。",
            "马晓东学员节奏感较弱，建议使用节拍器进行专门的节奏训练。",
            "朱丽华学员音乐理论基础薄弱，需要在实践中加强乐理知识的讲解。",
            "胡建军学员左右手配合不够协调，建议进行分手练习和慢速合手训练。",
            "林雅静学员对音色控制有天赋，可以重点培养其音乐表现力。",
            "何志明学员练习态度很认真，但方法需要改进，请指导正确的练习方法。"
        ]
        
        for i in range(25):  # 减少到25个提醒
            student = random.choice(self.students)
            creator = random.choice(self.persons)
            
            reminder = Reminder.objects.create(
                sender=creator,
                receiver=random.choice(operators + teachers),
                student=student,
                content=random.choice(reminder_contents),
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
        
        # 成人钢琴教育的公告内容
        announcement_contents = [
            "【重要通知】2024年春季钢琴等级考试报名开始，报名截止时间为3月15日。有意向参加考试的学员请尽快联系任课老师或前台咨询报名事宜。考试时间预计在5月中旬，具体时间以考级委员会通知为准。",
            "【教学安排】由于春节假期安排，2月10日-2月17日暂停所有课程。2月18日（正月初九）正式复课。请各位学员合理安排假期练习时间，保持手感。复课后如需调整上课时间，请提前与老师沟通。",
            "【设备维护】本周三（3月8日）下午2:00-5:00进行钢琴调音和设备维护，期间暂停使用3号和5号教室。受影响的课程已提前通知学员调整时间或更换教室，请大家配合。",
            "【学员活动】学校将于4月底举办春季学员音乐会，欢迎有演出意愿的学员报名参加。演出曲目建议选择学习过的经典曲目或流行改编曲。报名截止时间为4月10日，详情请咨询任课老师。",
            "【教学研讨】本月教学研讨会主题为'成人钢琴教学中的常见问题及解决方案'，时间定于3月25日下午2:00，地点在会议室。欢迎各位老师积极参与讨论，分享教学经验。",
            "【新课程推出】应学员要求，学校新增'钢琴弹唱班'和'流行钢琴即兴伴奏班'，适合有一定基础的学员进阶学习。课程将于下月开班，感兴趣的学员可以咨询详细信息。",
            "【安全提醒】请各位学员注意教室安全，课后请关好门窗，贵重物品请随身携带。如发现设备故障或安全隐患，请及时报告前台或任课老师。",
            "【缴费通知】下月课时费缴费时间为本月25-30日，可选择现金、微信或支付宝支付。为避免影响正常上课，请学员按时缴费。如有特殊情况需要延期，请提前说明。"
        ]
        
        for i in range(8):
            announcement = Announcement.objects.create(
                publisher=random.choice(self.persons),
                type=random.choice([t[0] for t in AnnouncementType.choices]),
                content=announcement_contents[i],
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
        
        # 成人钢琴教育的回访记录内容
        follow_up_contents = [
            "学员反馈最近工作较忙，练习时间有限，建议调整练习计划，重点练习基础技巧。学员表示会尽量保证每天30分钟的练习时间。",
            "学员对目前的学习进度很满意，特别喜欢流行歌曲的改编版本。希望能学习更多经典流行歌曲的钢琴版本。",
            "学员反映手型问题有所改善，但还需要继续加强练习。建议在家练习时多注意手腕放松，避免紧张用力。",
            "学员询问是否可以参加钢琴考级，经评估其目前水平适合报考3级。建议加强音阶和练习曲的训练。",
            "学员表示对古典音乐产生了浓厚兴趣，希望能学习一些简化版的古典名曲。推荐从《致爱丽丝》开始学习。",
            "学员反馈上课时间需要调整，由于工作变动，希望改为周末上课。已协调安排周六下午的时间段。",
            "学员对踏板的使用还不够熟练，建议多做踏板练习，特别是连音踏板的技巧。下次课重点讲解踏板使用方法。",
            "学员询问是否可以学习弹唱，经评估其钢琴基础已达到要求。建议从简单的三和弦伴奏开始练习。",
            "学员反映最近练习积极性有所下降，经沟通了解是因为觉得进步缓慢。给予鼓励并调整了教学方法，增加趣味性。",
            "学员希望能参加学校的音乐会演出，推荐其准备《卡农》简化版作为演出曲目。需要加强舞台表现力的训练。",
            "学员反馈家里钢琴音准有问题，建议联系调音师进行调音。同时提醒学员注意钢琴的日常保养。",
            "学员询问如何提高视奏能力，建议每天进行15分钟的视奏练习，从简单的乐谱开始逐步提高难度。",
            "学员表示对音乐理论知识感兴趣，希望能系统学习乐理。建议报名参加学校的音乐理论基础班。",
            "学员反映左右手配合还有困难，建议多做分手练习，然后慢速合手，逐步提高配合的协调性。",
            "学员询问如何选择适合的练习曲目，根据其当前水平推荐了几首适合的练习曲和乐曲。",
            "学员反馈对节奏掌握不够准确，建议使用节拍器练习，从慢速开始逐步提高速度。",
            "学员表示希望能演奏一些影视金曲，推荐了几首适合其水平的影视音乐改编版本。",
            "学员询问如何改善音色表现，建议多注意触键方式和力度控制，练习不同的音色变化。",
            "学员反映对和弦理解有困难，建议从基础三和弦开始学习，逐步掌握和弦的构成和连接。",
            "学员表示想学习即兴演奏，建议先掌握基本的和弦进行，然后练习简单的即兴伴奏模式。"
        ]
        
        follow_up_results = [
            "学员接受建议，表示会按照老师的指导进行练习，下次回访时跟进练习效果。",
            "学员很满意当前的学习安排，表示会继续保持练习积极性。",
            "学员对提出的建议表示认同，但担心练习时间不够，需要进一步协调时间安排。",
            "学员非常感谢老师的耐心指导，表示会更加努力练习。",
            "学员对课程安排很满意，希望能继续保持现有的教学进度。",
            "学员提出了一些新的学习需求，需要与任课老师沟通调整教学计划。",
            "学员反馈良好，表示会按照建议加强薄弱环节的练习。",
            "学员对学习效果比较满意，但希望能有更多的表演机会。"
        ]
        
        for i in range(35):  # 减少到35个回访记录
            student = random.choice(self.students)
            operator = random.choice(operators)
            
            followup = FollowUpRecord.objects.create(
                student=student,
                operator=operator,
                seq_no=i + 1,
                purpose=random.choice([p[0] for p in FollowUpPurpose.choices]),
                urgency=random.choice([u[0] for u in FollowUpUrgency.choices]),
                status=random.choice([s[0] for s in FollowUpStatus.choices]),
                content=random.choice(follow_up_contents),
                result=random.choice(follow_up_results) if random.random() > 0.3 else None,
                need_follow_up=random.choice([True, False]),
                next_follow_up_at=fake.future_datetime(end_date='+20d', tzinfo=timezone.get_current_timezone()) if random.random() > 0.5 else None,
                created_by=operator
            )
            self.followups.append(followup)
        
        print(f"生成了 {len(self.followups)} 个回访记录")
    
    def generate_notifications(self):
        """生成通知"""
        print("生成通知...")
        
        notification_count = 0
        
        # 成人钢琴教育的通知标题和内容
        notification_templates = [
            ("新的点评任务分配", "您有一个新的学员点评任务需要处理，请及时查看并完成点评。"),
            ("学员课程进度提醒", "学员的课程学习进度需要关注，建议加强练习指导。"),
            ("教学研讨会通知", "本月教学研讨会即将举行，请准时参加并准备相关材料。"),
            ("学员反馈处理", "收到学员反馈信息，需要及时跟进处理相关问题。"),
            ("课程安排调整", "由于特殊情况，部分课程时间需要调整，请查看详细安排。"),
            ("设备维护通知", "教室设备将进行维护，请注意时间安排避免冲突。"),
            ("学员音乐会报名", "春季学员音乐会开始报名，请协助符合条件的学员报名参加。"),
            ("考级报名提醒", "钢琴等级考试报名即将截止，请提醒有意向的学员尽快报名。"),
            ("新学员分配", "有新学员需要分配任课老师，请查看学员信息并确认。"),
            ("教学质量评估", "本月教学质量评估开始，请配合完成相关评估工作。"),
            ("学员回访安排", "需要对部分学员进行回访，请按照安排及时联系学员。"),
            ("课时费缴费提醒", "部分学员课时费即将到期，请提醒学员及时缴费。"),
            ("教学资料更新", "教学资料库有新的内容更新，请及时查看和下载。"),
            ("安全检查通知", "将进行教室安全检查，请配合检查工作并及时整改问题。"),
            ("节假日安排通知", "节假日课程安排已确定，请查看具体时间安排。")
        ]
        
        # 为每个人员生成一些通知
        for person in self.persons:
            for i in range(random.randint(4, 7)):
                # 随机选择关联对象
                link_type = random.choice([t[0] for t in LinkType.choices])
                link_id = None
                
                # 由于大部分模型使用UUID主键，而link_id是BigIntegerField，暂时设为None
                # 或者可以使用随机整数作为示例
                if random.random() > 0.5:  # 50%概率有关联
                    link_id = random.randint(1, 1000)
                
                title, message = random.choice(notification_templates)
                
                Notification.objects.create(
                    recipient=person,
                    type=random.choice([t[0] for t in NotificationType.choices]),
                    title=title,
                    message=message,
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