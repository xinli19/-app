import pandas as pd
import json

def read_excel_file(file_path):
    """
    读取Excel文件并分析其结构
    """
    try:
        # 读取所有sheet
        excel_file = pd.ExcelFile(file_path)
        print(f"Excel文件包含的sheet: {excel_file.sheet_names}")
        
        # 读取每个sheet的数据
        sheets_data = {}
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            sheets_data[sheet_name] = df
            print(f"\n=== {sheet_name} ====")
            print(f"形状: {df.shape}")
            print(f"列名: {list(df.columns)}")
            print("前5行数据:")
            print(df.head())
            print("\n")
        
        return sheets_data
    except Exception as e:
        print(f"读取Excel文件时出错: {e}")
        return None

def clean_course_data(sheets_data):
    """
    清洗课程数据
    """
    cleaned_data = {
        'basic_courses': [],  # 基础班课程
        'intermediate_courses': []  # 中级班课程
    }
    
    # 处理基础班数据 (Sheet1)
    if 'Sheet1' in sheets_data or len(sheets_data) >= 1:
        sheet1_name = list(sheets_data.keys())[0]
        basic_df = sheets_data[sheet1_name]
        print(f"处理基础班数据 ({sheet1_name})...")
        cleaned_data['basic_courses'] = process_course_sheet(basic_df, '基础班')
    
    # 处理中级班数据 (Sheet2)
    if 'Sheet2' in sheets_data or len(sheets_data) >= 2:
        sheet2_name = list(sheets_data.keys())[1] if len(sheets_data) >= 2 else None
        if sheet2_name:
            intermediate_df = sheets_data[sheet2_name]
            print(f"处理中级班数据 ({sheet2_name})...")
            cleaned_data['intermediate_courses'] = process_course_sheet(intermediate_df, '中级班')
    
    return cleaned_data

def process_course_sheet(df, course_type):
    """
    处理单个sheet的课程数据
    """
    courses = []
    
    # 打印列名以便调试
    print(f"列名: {list(df.columns)}")
    
    # 尝试识别课程序号列和曲目列
    course_num_col = None
    song_cols = []
    
    for col in df.columns:
        col_str = str(col).lower()
        if '序号' in col_str or '课程' in col_str or 'course' in col_str:
            course_num_col = col
        elif '曲目' in col_str or 'song' in col_str or '名' in col_str:
            song_cols.append(col)
    
    # 如果没有找到明确的列名，使用位置推断
    if course_num_col is None and len(df.columns) > 0:
        course_num_col = df.columns[0]  # 假设第一列是课程序号
    
    if not song_cols and len(df.columns) > 1:
        song_cols = df.columns[1:4]  # 假设后面几列是曲目
    
    print(f"课程序号列: {course_num_col}")
    print(f"曲目列: {song_cols}")
    
    # 处理数据
    for index, row in df.iterrows():
        if pd.isna(row[course_num_col]):
            continue
            
        course_num = str(row[course_num_col]).strip()
        if not course_num or course_num == 'nan':
            continue
            
        songs = []
        for song_col in song_cols:
            if song_col in row and not pd.isna(row[song_col]):
                song_name = str(row[song_col]).strip()
                if song_name and song_name != 'nan':
                    songs.append(song_name)
        
        course_data = {
            'course_number': course_num,
            'course_type': course_type,
            'songs': songs
        }
        courses.append(course_data)
    
    return courses

def save_cleaned_data(cleaned_data, output_file):
    """
    保存清洗后的数据
    """
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
    print(f"清洗后的数据已保存到: {output_file}")

if __name__ == "__main__":
    # Excel文件路径
    excel_file_path = "/Users/xiny_li/app/【基础班＋中级班】课程＆曲目列表（20250908）.xlsx"
    
    # 读取Excel文件
    print("正在读取Excel文件...")
    sheets_data = read_excel_file(excel_file_path)
    
    if sheets_data:
        # 清洗数据
        print("\n正在清洗数据...")
        cleaned_data = clean_course_data(sheets_data)
        
        # 保存清洗后的数据
        output_file = "/Users/xiny_li/app/cleaned_course_data.json"
        save_cleaned_data(cleaned_data, output_file)
        
        # 打印统计信息
        print(f"\n=== 数据清洗完成 ===")
        print(f"基础班课程数量: {len(cleaned_data['basic_courses'])}")
        print(f"中级班课程数量: {len(cleaned_data['intermediate_courses'])}")
        
        # 显示部分示例数据
        if cleaned_data['basic_courses']:
            print("\n基础班示例数据:")
            for i, course in enumerate(cleaned_data['basic_courses'][:3]):
                print(f"  课程{course['course_number']}: {course['songs']}")
        
        if cleaned_data['intermediate_courses']:
            print("\n中级班示例数据:")
            for i, course in enumerate(cleaned_data['intermediate_courses'][:3]):
                print(f"  课程{course['course_number']}: {course['songs']}")
    else:
        print("无法读取Excel文件")