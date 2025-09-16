import json
import os
import sys
import django
from datetime import datetime

# 添加Django项目路径
sys.path.append('/Users/xiny_li/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_system.settings')
django.setup()

from apps.courses.models import Course, Lesson, Piece
from apps.core.enums import EnableStatus, LessonCategory, PieceAttribute

class CourseDataProcessor:
    """
    课程数据处理器
    """
    
    def __init__(self, json_file_path):
        self.json_file_path = json_file_path
        self.data = None
        
    def load_data(self):
        """
        加载JSON数据
        """
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            print(f"成功加载数据文件: {self.json_file_path}")
            return True
        except Exception as e:
            print(f"加载数据文件失败: {e}")
            return False
    
    def validate_data(self):
        """
        验证数据格式
        """
        if not self.data:
            print("数据为空")
            return False
            
        required_keys = ['basic_courses', 'intermediate_courses']
        for key in required_keys:
            if key not in self.data:
                print(f"缺少必要的数据键: {key}")
                return False
                
        print("数据格式验证通过")
        return True
    
    def convert_to_django_format(self):
        """
        转换为Django模型格式
        根据实际的Course-Lesson-Piece结构来组织数据
        """
        # 创建课程数据结构
        courses_data = {
            '基础班': {
                'course': {
                    'name': '基础班',
                    'status': EnableStatus.ENABLED.value,
                    'description': '钢琴基础班课程'
                },
                'lessons': []
            },
            '中级班': {
                'course': {
                    'name': '中级班', 
                    'status': EnableStatus.ENABLED.value,
                    'description': '钢琴中级班课程'
                },
                'lessons': []
            }
        }
        
        # 处理基础班课程
        for i, lesson_data in enumerate(self.data['basic_courses'], 1):
            lesson = {
                'name': lesson_data['course_number'],
                'status': EnableStatus.ENABLED.value,
                'sort_order': i,
                'description': f"基础班{lesson_data['course_number']}",
                'pieces': []
            }
            
            # 添加曲目
            for song_name in lesson_data['songs']:
                piece = {
                    'name': song_name,
                    'status': EnableStatus.ENABLED.value,
                    'attribute': PieceAttribute.MUSIC.value,  # 默认为乐曲
                    'is_required': True,
                    'description': f"基础班{lesson_data['course_number']}曲目"
                }
                lesson['pieces'].append(piece)
            
            courses_data['基础班']['lessons'].append(lesson)
        
        # 处理中级班课程
        for i, lesson_data in enumerate(self.data['intermediate_courses'], 1):
            lesson = {
                'name': lesson_data['course_number'],
                'status': EnableStatus.ENABLED.value,
                'sort_order': i,
                'description': f"中级班{lesson_data['course_number']}",
                'pieces': []
            }
            
            # 添加曲目
            for song_name in lesson_data['songs']:
                piece = {
                    'name': song_name,
                    'status': EnableStatus.ENABLED.value,
                    'attribute': self._determine_piece_attribute(song_name),
                    'is_required': True,
                    'description': f"中级班{lesson_data['course_number']}曲目"
                }
                lesson['pieces'].append(piece)
            
            courses_data['中级班']['lessons'].append(lesson)
        
        return courses_data
    
    def _determine_piece_attribute(self, song_name):
        """
        根据曲目名称判断曲目属性
        """
        song_name_lower = song_name.lower()
        
        # 练习曲关键词
        etude_keywords = ['练习曲', '车尔尼', '莱蒙', '哈农', 'czerny', 'lemoine', 'hanon']
        # 技术练习关键词
        technique_keywords = ['音阶', '琶音', '和弦', '八度', '训练', '支撑', '行走']
        
        for keyword in etude_keywords:
            if keyword in song_name_lower:
                return PieceAttribute.ETUDE.value
        
        for keyword in technique_keywords:
            if keyword in song_name_lower:
                return PieceAttribute.TECHNIQUE.value
        
        # 默认为乐曲
        return PieceAttribute.MUSIC.value
    
    def save_django_format(self, output_file):
        """
        保存Django格式的数据
        """
        django_courses = self.convert_to_django_format()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(django_courses, f, ensure_ascii=False, indent=2, default=str)
        
        print(f"Django格式数据已保存到: {output_file}")
        return django_courses
    
    def import_to_database(self, clear_existing=False):
        """
        导入数据到数据库
        按照Course-Lesson-Piece的层次结构导入
        """
        if clear_existing:
            print("清除现有课程数据...")
            # 由于外键约束，需要按顺序删除
            Piece.objects.all().delete()
            Lesson.objects.all().delete()
            Course.objects.all().delete()
        
        courses_data = self.convert_to_django_format()
        
        course_created = 0
        course_updated = 0
        lesson_created = 0
        lesson_updated = 0
        piece_created = 0
        piece_updated = 0
        
        for course_name, course_info in courses_data.items():
            # 创建或更新课程
            course, created = Course.objects.get_or_create(
                name=course_info['course']['name'],
                defaults={
                    'status': course_info['course']['status'],
                    'description': course_info['course']['description']
                }
            )
            
            if created:
                course_created += 1
                print(f"创建课程: {course.name}")
            else:
                course.status = course_info['course']['status']
                course.description = course_info['course']['description']
                course.save()
                course_updated += 1
                print(f"更新课程: {course.name}")
            
            # 处理课程下的课
            for lesson_info in course_info['lessons']:
                # 使用更精确的查询条件，包括课程名称
                lesson, created = Lesson.objects.get_or_create(
                    course=course,
                    name=lesson_info['name'],
                    defaults={
                        'sort_order': lesson_info['sort_order'],
                        'status': lesson_info['status'],
                        'description': lesson_info['description']
                    }
                )
                
                if created:
                    lesson_created += 1
                    print(f"  创建课: {lesson.name}")
                else:
                    lesson.sort_order = lesson_info['sort_order']
                    lesson.status = lesson_info['status']
                    lesson.description = lesson_info['description']
                    lesson.save()
                    lesson_updated += 1
                    print(f"  更新课: {lesson.name}")
                
                # 处理课下的曲目
                for piece_info in lesson_info['pieces']:
                    piece, created = Piece.objects.get_or_create(
                        course=course,
                        lesson=lesson,
                        name=piece_info['name'],
                        defaults={
                            'status': piece_info['status'],
                            'attribute': piece_info['attribute'],
                            'is_required': piece_info['is_required'],
                            'description': piece_info['description']
                        }
                    )
                    
                    if created:
                        piece_created += 1
                        print(f"    创建曲目: {piece.name}")
                    else:
                        piece.status = piece_info['status']
                        piece.attribute = piece_info['attribute']
                        piece.is_required = piece_info['is_required']
                        piece.description = piece_info['description']
                        piece.save()
                        piece_updated += 1
                        print(f"    更新曲目: {piece.name}")
        
        print(f"\n数据导入完成:")
        print(f"课程 - 创建: {course_created}, 更新: {course_updated}")
        print(f"课 - 创建: {lesson_created}, 更新: {lesson_updated}")
        print(f"曲目 - 创建: {piece_created}, 更新: {piece_updated}")
        print(f"\n当前数据库统计:")
        print(f"总课程数量: {Course.objects.count()}")
        print(f"总课数量: {Lesson.objects.count()}")
        print(f"总曲目数量: {Piece.objects.count()}")
        
        return {
            'course': {'created': course_created, 'updated': course_updated},
            'lesson': {'created': lesson_created, 'updated': lesson_updated},
            'piece': {'created': piece_created, 'updated': piece_updated}
        }
    
    def generate_summary_report(self):
        """
        生成数据摘要报告
        """
        if not self.data:
            print("没有数据可生成报告")
            return
        
        basic_courses = self.data['basic_courses']
        intermediate_courses = self.data['intermediate_courses']
        
        print("\n=== 课程数据摘要报告 ===")
        print(f"基础班课程数量: {len(basic_courses)}")
        print(f"中级班课程数量: {len(intermediate_courses)}")
        print(f"总课程数量: {len(basic_courses) + len(intermediate_courses)}")
        
        # 统计曲目数量
        basic_songs_count = sum(len(course['songs']) for course in basic_courses)
        intermediate_songs_count = sum(len(course['songs']) for course in intermediate_courses)
        
        print(f"\n基础班总曲目数量: {basic_songs_count}")
        print(f"中级班总曲目数量: {intermediate_songs_count}")
        print(f"总曲目数量: {basic_songs_count + intermediate_songs_count}")
        
        # 平均每课曲目数量
        if basic_courses:
            avg_basic = basic_songs_count / len(basic_courses)
            print(f"基础班平均每课曲目数量: {avg_basic:.1f}")
        
        if intermediate_courses:
            avg_intermediate = intermediate_songs_count / len(intermediate_courses)
            print(f"中级班平均每课曲目数量: {avg_intermediate:.1f}")
        
        # 显示课程列表
        print("\n=== 基础班课程列表 ===")
        for i, course in enumerate(basic_courses[:10], 1):  # 只显示前10个
            print(f"{i:2d}. {course['course_number']} ({len(course['songs'])}首曲目)")
        if len(basic_courses) > 10:
            print(f"    ... 还有{len(basic_courses) - 10}个课程")
        
        print("\n=== 中级班课程列表 ===")
        for i, course in enumerate(intermediate_courses[:10], 1):  # 只显示前10个
            print(f"{i:2d}. {course['course_number']} ({len(course['songs'])}首曲目)")
        if len(intermediate_courses) > 10:
            print(f"    ... 还有{len(intermediate_courses) - 10}个课程")

def main():
    """
    主函数
    """
    json_file = "/Users/xiny_li/app/cleaned_course_data.json"
    
    # 创建处理器实例
    processor = CourseDataProcessor(json_file)
    
    # 加载和验证数据
    if not processor.load_data():
        return
    
    if not processor.validate_data():
        return
    
    # 生成摘要报告
    processor.generate_summary_report()
    
    # 保存Django格式数据
    django_output_file = "/Users/xiny_li/app/django_course_data.json"
    processor.save_django_format(django_output_file)
    
    # 询问是否导入到数据库
    print("\n是否要将数据导入到数据库？(y/n): ", end="")
    choice = input().lower().strip()
    
    if choice == 'y' or choice == 'yes':
        print("\n注意：由于数据库中存在外键约束，将以更新/追加模式导入数据")
        print("现有数据不会被删除，只会更新或添加新的课程数据")
        
        try:
            result = processor.import_to_database(clear_existing=False)
            print("\n数据导入成功！")
        except Exception as e:
            print(f"\n数据导入失败: {e}")
            print("\n建议检查数据库连接和模型定义是否正确")
    else:
        print("\n跳过数据库导入")

if __name__ == "__main__":
    main()