from django.db import migrations

def forwards(apps, schema_editor):
    """
    将历史数据从 piece_version 映射到 piece：
    piece = piece_version.piece
    """
    db = schema_editor.connection.alias
    FPD = apps.get_model('evaluations', 'FeedbackPieceDetail')
    PieceVersion = apps.get_model('courses', 'PieceVersion')

    # 只处理 piece 为空而 piece_version 非空的记录
    for fpd in FPD.objects.using(db).all().only('id', 'piece_id', 'piece_version_id'):
        if fpd.piece_id:
            continue
        pv_id = getattr(fpd, 'piece_version_id', None)
        if not pv_id:
            continue
        try:
            pv = PieceVersion.objects.using(db).only('piece_id').get(pk=pv_id)
        except PieceVersion.DoesNotExist:
            continue
        # 回填 piece
        fpd.piece_id = pv.piece_id
        fpd.save(update_fields=['piece'])

def backwards(apps, schema_editor):
    """
    回滚时不自动回写 piece_version。
    如需严格对称，可在此补充 piece_version = 由 piece 推断；此处留空以避免误回填。
    """
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('evaluations', '0002_add_piece_field'),
        ('courses', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]