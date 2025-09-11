from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    """
    第一步：新增可空字段 piece，保留旧的 piece_version 字段与唯一约束不变。
    这样可以在下一步迁移中把历史数据从 piece_version 映射到 piece。
    """

    dependencies = [
        ('evaluations', '0001_initial'),
        ('courses', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='feedbackpiecedetail',
            name='piece',
            field=models.ForeignKey(
                to='courses.piece',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='feedback_details',
                verbose_name='曲目',
                null=True,
                blank=True,
            ),
        ),
        migrations.AddIndex(
            model_name='feedbackpiecedetail',
            index=models.Index(fields=['piece'], name='idx_fpd_piece'),
        ),
    ]