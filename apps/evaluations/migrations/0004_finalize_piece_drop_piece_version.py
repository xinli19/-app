from django.db import migrations, models

class Migration(migrations.Migration):
    """
    第三步：收尾
    - 删除旧唯一约束 uq_feedback_piece（原基于 piece_version）
    - 删除旧索引 idx_fpd_piece_ver
    - 移除字段 piece_version
    - 将 piece 设为非空
    - 添加新唯一约束 uq_feedback_piece（基于 feedback+piece）
    """

    dependencies = [
        ('evaluations', '0003_copy_piece_from_piece_version'),
    ]

    operations = [
        # 先删约束与索引（否则删字段会报错）
        migrations.RemoveConstraint(
            model_name='feedbackpiecedetail',
            name='uq_feedback_piece',
        ),
        migrations.RemoveIndex(
            model_name='feedbackpiecedetail',
            name='idx_fpd_piece_ver',
        ),

        # 删除旧字段
        migrations.RemoveField(
            model_name='feedbackpiecedetail',
            name='piece_version',
        ),

        # 将 piece 设为非空
        migrations.AlterField(
            model_name='feedbackpiecedetail',
            name='piece',
            field=models.ForeignKey(
                to='courses.piece',
                on_delete=models.deletion.PROTECT,
                related_name='feedback_details',
                verbose_name='曲目',
                null=False,
                blank=False,
            ),
        ),

        # 添加新唯一约束（复用相同名称，便于历史兼容）
        migrations.AddConstraint(
            model_name='feedbackpiecedetail',
            constraint=models.UniqueConstraint(
                fields=['feedback', 'piece'],
                name='uq_feedback_piece',
            ),
        ),
    ]