# Generated migration to alter created_at field with auto_now_add

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0032_populate_created_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tblusers',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True),
        ),
    ]
