# Generated by Django 4.1.4 on 2023-04-27 15:27

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('start', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='info',
            name='team',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='start.teams'),
        ),
    ]
