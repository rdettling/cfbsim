# Generated by Django 4.2.3 on 2023-08-28 04:49

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Conferences',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('confName', models.CharField(max_length=255)),
                ('confFullName', models.CharField(max_length=255)),
                ('confGames', models.IntegerField()),
            ],
        ),
        migrations.CreateModel(
            name='Drives',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('driveNum', models.IntegerField()),
                ('startingFP', models.IntegerField()),
                ('result', models.CharField(max_length=50)),
                ('points', models.IntegerField()),
            ],
        ),
        migrations.CreateModel(
            name='Games',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('labelA', models.CharField(max_length=50, null=True)),
                ('labelB', models.CharField(max_length=50, null=True)),
                ('spreadA', models.CharField(max_length=50)),
                ('spreadB', models.CharField(max_length=50)),
                ('moneylineA', models.CharField(max_length=50)),
                ('moneylineB', models.CharField(max_length=50)),
                ('winProbA', models.FloatField()),
                ('winProbB', models.FloatField()),
                ('weekPlayed', models.IntegerField()),
                ('gameNumA', models.IntegerField()),
                ('gameNumB', models.IntegerField()),
                ('resultA', models.CharField(max_length=50, null=True)),
                ('resultB', models.CharField(max_length=50, null=True)),
                ('overtime', models.IntegerField()),
                ('scoreA', models.IntegerField(null=True)),
                ('scoreB', models.IntegerField(null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Info',
            fields=[
                ('user_id', models.CharField(max_length=255, primary_key=True, serialize=False)),
                ('currentWeek', models.IntegerField()),
                ('currentYear', models.IntegerField()),
            ],
        ),
        migrations.CreateModel(
            name='Teams',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50)),
                ('abbreviation', models.CharField(max_length=4)),
                ('prestige', models.IntegerField()),
                ('rating', models.IntegerField()),
                ('offense', models.IntegerField()),
                ('defense', models.IntegerField()),
                ('mascot', models.CharField(max_length=50)),
                ('colorPrimary', models.CharField(max_length=7)),
                ('colorSecondary', models.CharField(max_length=7)),
                ('confWins', models.IntegerField()),
                ('confLosses', models.IntegerField()),
                ('nonConfWins', models.IntegerField()),
                ('nonConfLosses', models.IntegerField()),
                ('totalWins', models.IntegerField()),
                ('totalLosses', models.IntegerField()),
                ('resume', models.FloatField()),
                ('expectedWins', models.FloatField()),
                ('ranking', models.IntegerField()),
                ('conference', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='start.conferences')),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='start.info')),
            ],
        ),
        migrations.CreateModel(
            name='Plays',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('startingFP', models.IntegerField()),
                ('down', models.IntegerField()),
                ('yardsLeft', models.IntegerField()),
                ('playType', models.CharField(max_length=50)),
                ('yardsGained', models.IntegerField()),
                ('result', models.CharField(max_length=50)),
                ('header', models.CharField(max_length=255, null=True)),
                ('text', models.CharField(max_length=255, null=True)),
                ('defense', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays_as_defense', to='start.teams')),
                ('drive', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays', to='start.drives')),
                ('game', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays', to='start.games')),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays', to='start.info')),
                ('offense', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays_as_offense', to='start.teams')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='Players',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('first', models.CharField(max_length=50)),
                ('last', models.CharField(max_length=50)),
                ('year', models.CharField(max_length=2)),
                ('pos', models.CharField(max_length=2)),
                ('rating', models.IntegerField()),
                ('starter', models.BooleanField()),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='players', to='start.info')),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='players', to='start.teams')),
            ],
        ),
        migrations.AddField(
            model_name='info',
            name='team',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='infos', to='start.teams'),
        ),
        migrations.AddField(
            model_name='games',
            name='info',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='games', to='start.info'),
        ),
        migrations.AddField(
            model_name='games',
            name='teamA',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='games_as_teamA', to='start.teams'),
        ),
        migrations.AddField(
            model_name='games',
            name='teamB',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='games_as_teamB', to='start.teams'),
        ),
        migrations.AddField(
            model_name='games',
            name='winner',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='games_as_winner', to='start.teams'),
        ),
        migrations.CreateModel(
            name='GameLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pass_yards', models.IntegerField(default=0)),
                ('pass_attempts', models.IntegerField(default=0)),
                ('pass_completions', models.IntegerField(default=0)),
                ('pass_touchdowns', models.IntegerField(default=0)),
                ('pass_interceptions', models.IntegerField(default=0)),
                ('rush_yards', models.IntegerField(default=0)),
                ('rush_attempts', models.IntegerField(default=0)),
                ('rush_touchdowns', models.IntegerField(default=0)),
                ('receiving_yards', models.IntegerField(default=0)),
                ('receiving_catches', models.IntegerField(default=0)),
                ('receiving_touchdowns', models.IntegerField(default=0)),
                ('fumbles', models.IntegerField(default=0)),
                ('tackles', models.IntegerField(default=0)),
                ('sacks', models.FloatField(default=0.0)),
                ('interceptions', models.IntegerField(default=0)),
                ('fumbles_forced', models.IntegerField(default=0)),
                ('fumbles_recovered', models.IntegerField(default=0)),
                ('field_goals_made', models.IntegerField(default=0)),
                ('field_goals_attempted', models.IntegerField(default=0)),
                ('extra_points_made', models.IntegerField(default=0)),
                ('extra_points_attempted', models.IntegerField(default=0)),
                ('game', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='game_logs', to='start.games')),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='game_logs', to='start.info')),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='game_logs', to='start.players')),
            ],
        ),
        migrations.AddField(
            model_name='drives',
            name='defense',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='drives_as_defense', to='start.teams'),
        ),
        migrations.AddField(
            model_name='drives',
            name='game',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='drives', to='start.games'),
        ),
        migrations.AddField(
            model_name='drives',
            name='info',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='drives', to='start.info'),
        ),
        migrations.AddField(
            model_name='drives',
            name='offense',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='drives_as_offense', to='start.teams'),
        ),
        migrations.AddField(
            model_name='conferences',
            name='info',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='conferences', to='start.info'),
        ),
    ]
