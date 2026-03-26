# Generated migration to populate created_at for existing users

from django.db import migrations
from django.utils import timezone


def populate_created_at(apps, schema_editor):
    """Populate created_at for users where it's NULL"""
    TblUsers = apps.get_model('api', 'TblUsers')
    now = timezone.now()
    
    # Update all NULL created_at values with current timestamp
    TblUsers.objects.filter(created_at__isnull=True).update(created_at=now)


def reverse_populate(apps, schema_editor):
    """Reverse operation - set created_at back to NULL (not typically needed)"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0031_rename_tbl_availab_type_idx_tbl_availab_type_0fabe7_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(populate_created_at, reverse_populate),
    ]
