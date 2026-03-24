# Generated migration to add change request support

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_tblproctorattendancehistory_substituted_for_id_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='tblavailability',
            name='type',
            field=models.CharField(
                choices=[('availability', 'Regular Availability'), ('change_request', 'Change Request')],
                default='availability',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='tblavailability',
            name='requested_status',
            field=models.CharField(
                blank=True,
                choices=[('available', 'Available'), ('unavailable', 'Unavailable')],
                max_length=20,
                null=True
            ),
        ),
        migrations.AddIndex(
            model_name='tblavailability',
            index=models.Index(fields=['type'], name='tbl_availab_type_idx'),
        ),
        migrations.AddIndex(
            model_name='tblavailability',
            index=models.Index(fields=['type', 'status'], name='tbl_availab_type_stat_idx'),
        ),
    ]
