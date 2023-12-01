# Generated by Django 4.2.3 on 2023-12-01 16:28

import django.core.validators
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
                ('confName', models.CharField(max_length=50)),
                ('confFullName', models.CharField(max_length=50)),
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
                ('points_needed', models.IntegerField()),
                ('scoreAAfter', models.IntegerField()),
                ('scoreBAfter', models.IntegerField()),
            ],
        ),
        migrations.CreateModel(
            name='Games',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('labelA', models.CharField(max_length=50)),
                ('labelB', models.CharField(max_length=50)),
                ('spreadA', models.CharField(max_length=10)),
                ('spreadB', models.CharField(max_length=10)),
                ('moneylineA', models.CharField(max_length=10)),
                ('moneylineB', models.CharField(max_length=10)),
                ('winProbA', models.FloatField()),
                ('winProbB', models.FloatField()),
                ('weekPlayed', models.IntegerField()),
                ('year', models.IntegerField()),
                ('rankATOG', models.IntegerField()),
                ('rankBTOG', models.IntegerField()),
                ('resultA', models.CharField(max_length=1, null=True)),
                ('resultB', models.CharField(max_length=1, null=True)),
                ('overtime', models.IntegerField(default=0)),
                ('scoreA', models.IntegerField(null=True)),
                ('scoreB', models.IntegerField(null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Info',
            fields=[
                ('user_id', models.CharField(max_length=255, primary_key=True, serialize=False)),
                ('currentWeek', models.IntegerField(null=True)),
                ('currentYear', models.IntegerField()),
                ('startYear', models.IntegerField()),
                ('stage', models.CharField(max_length=50)),
            ],
        ),
        migrations.CreateModel(
            name='Teams',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50)),
                ('abbreviation', models.CharField(max_length=4)),
                ('prestige', models.IntegerField()),
                ('rating', models.IntegerField(null=True)),
                ('offense', models.IntegerField(null=True)),
                ('defense', models.IntegerField(null=True)),
                ('mascot', models.CharField(max_length=50)),
                ('colorPrimary', models.CharField(max_length=7)),
                ('colorSecondary', models.CharField(max_length=7)),
                ('confGames', models.IntegerField(default=0)),
                ('confLimit', models.IntegerField()),
                ('confWins', models.IntegerField(default=0)),
                ('confLosses', models.IntegerField(default=0)),
                ('nonConfGames', models.IntegerField(default=0)),
                ('nonConfLimit', models.IntegerField()),
                ('nonConfWins', models.IntegerField(default=0)),
                ('nonConfLosses', models.IntegerField(default=0)),
                ('gamesPlayed', models.IntegerField(default=0)),
                ('totalWins', models.IntegerField(default=0)),
                ('totalLosses', models.IntegerField(default=0)),
                ('resume_total', models.FloatField(default=0)),
                ('resume', models.FloatField(default=0)),
                ('ranking', models.IntegerField(null=True)),
                ('last_rank', models.IntegerField(null=True)),
                ('offers', models.IntegerField()),
                ('recruiting_points', models.IntegerField()),
                ('conference', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='start.conferences')),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='start.info')),
            ],
        ),
        migrations.CreateModel(
            name='Years',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.IntegerField()),
                ('prestige', models.IntegerField()),
                ('rating', models.IntegerField()),
                ('wins', models.IntegerField()),
                ('losses', models.IntegerField()),
                ('rank', models.IntegerField()),
                ('conference', models.CharField(max_length=50)),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='years', to='start.info')),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='years', to='start.teams')),
            ],
        ),
        migrations.CreateModel(
            name='Recruits',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('first', models.CharField(max_length=50)),
                ('last', models.CharField(max_length=50)),
                ('pos', models.CharField(max_length=2)),
                ('overall_rank', models.IntegerField()),
                ('state_rank', models.IntegerField()),
                ('position_rank', models.IntegerField()),
                ('stars', models.IntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ('state', models.CharField(max_length=2)),
                ('min_prestige', models.IntegerField()),
                ('committed_team', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='committed_recruits', to='start.teams')),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recruits', to='start.info')),
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
                ('text', models.CharField(max_length=100, null=True)),
                ('header', models.CharField(max_length=100, null=True)),
                ('defense', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays_as_defense', to='start.teams')),
                ('drive', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='plays', to='start.drives')),
                ('game', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays', to='start.games')),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays', to='start.info')),
                ('offense', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plays_as_offense', to='start.teams')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='Playoff',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('teams', models.IntegerField()),
                ('autobids', models.IntegerField()),
                ('lastWeek', models.IntegerField()),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='playoff_info', to='start.info')),
                ('left_quarter_1', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='left_quarter_1', to='start.games')),
                ('left_quarter_2', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='left_quarter_2', to='start.games')),
                ('left_r1_1', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='left_r1_1', to='start.games')),
                ('left_r1_2', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='left_r1_2', to='start.games')),
                ('left_semi', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='left_semi', to='start.games')),
                ('natty', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='natty', to='start.games')),
                ('right_quarter_1', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='right_quarter_1', to='start.games')),
                ('right_quarter_2', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='right_quarter_2', to='start.games')),
                ('right_r1_1', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='right_r1_1', to='start.games')),
                ('right_r1_2', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='right_r1_2', to='start.games')),
                ('right_semi', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='right_semi', to='start.games')),
                ('seed_1', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='seed_1', to='start.teams')),
                ('seed_2', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='seed_2', to='start.teams')),
                ('seed_3', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='seed_3', to='start.teams')),
                ('seed_4', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='seed_4', to='start.teams')),
            ],
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
                ('rating_fr', models.IntegerField()),
                ('rating_so', models.IntegerField()),
                ('rating_jr', models.IntegerField()),
                ('rating_sr', models.IntegerField()),
                ('starter', models.BooleanField()),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='players', to='start.info')),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='players', to='start.teams')),
            ],
        ),
        migrations.CreateModel(
            name='Odds',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('diff', models.IntegerField()),
                ('favSpread', models.CharField(max_length=10)),
                ('udSpread', models.CharField(max_length=10)),
                ('favWinProb', models.FloatField()),
                ('udWinProb', models.FloatField()),
                ('favMoneyline', models.CharField(max_length=10)),
                ('udMoneyline', models.CharField(max_length=10)),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='odds', to='start.info')),
            ],
        ),
        migrations.AddField(
            model_name='info',
            name='playoff',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='infos', to='start.playoff'),
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
            name='championship',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='start.games'),
        ),
        migrations.AddField(
            model_name='conferences',
            name='info',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='conferences', to='start.info'),
        ),
        migrations.CreateModel(
            name='Offers',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('interest_level', models.IntegerField(default=0)),
                ('info', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='offers', to='start.info')),
                ('recruit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='offers', to='start.recruits')),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='extended_offers', to='start.teams')),
            ],
            options={
                'unique_together': {('recruit', 'team')},
            },
        ),
    ]
