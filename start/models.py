from django.db import models


class Info(models.Model):
    user_id = models.CharField(max_length=255, primary_key=True)
    currentWeek = models.IntegerField()
    currentYear = models.IntegerField()
    team = models.ForeignKey(
        "Teams", on_delete=models.SET_NULL, null=True, related_name="infos"
    )
    playoff = models.ForeignKey(
        "Playoff", on_delete=models.CASCADE, related_name="infos", null=True
    )


class Teams(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=50)
    abbreviation = models.CharField(max_length=4)
    prestige = models.IntegerField()
    rating = models.IntegerField()
    offense = models.IntegerField()
    defense = models.IntegerField()
    mascot = models.CharField(max_length=50)
    colorPrimary = models.CharField(max_length=7)
    colorSecondary = models.CharField(max_length=7)
    conference = models.ForeignKey(
        "Conferences", on_delete=models.CASCADE, related_name="teams", null=True
    )
    confGames = models.IntegerField()
    confLimit = models.IntegerField()
    confWins = models.IntegerField()
    confLosses = models.IntegerField()
    nonConfGames = models.IntegerField()
    nonConfLimit = models.IntegerField()
    nonConfWins = models.IntegerField()
    nonConfLosses = models.IntegerField()
    gamesPlayed = models.IntegerField()
    totalWins = models.IntegerField()
    totalLosses = models.IntegerField()
    resume_total = models.FloatField()
    resume = models.FloatField()
    expectedWins = models.FloatField()
    ranking = models.IntegerField()


class Players(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="players")
    team = models.ForeignKey(Teams, on_delete=models.CASCADE, related_name="players")
    first = models.CharField(max_length=50)
    last = models.CharField(max_length=50)
    year = models.CharField(max_length=2)
    pos = models.CharField(max_length=2)
    rating = models.IntegerField()
    starter = models.BooleanField()


class GameLog(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="game_logs")

    player = models.ForeignKey(
        Players, on_delete=models.CASCADE, related_name="game_logs"
    )
    game = models.ForeignKey(
        "Games", on_delete=models.CASCADE, related_name="game_logs"
    )

    pass_yards = models.IntegerField(default=0)
    pass_attempts = models.IntegerField(default=0)
    pass_completions = models.IntegerField(default=0)
    pass_touchdowns = models.IntegerField(default=0)
    pass_interceptions = models.IntegerField(default=0)

    rush_yards = models.IntegerField(default=0)
    rush_attempts = models.IntegerField(default=0)
    rush_touchdowns = models.IntegerField(default=0)

    receiving_yards = models.IntegerField(default=0)
    receiving_catches = models.IntegerField(default=0)
    receiving_touchdowns = models.IntegerField(default=0)

    fumbles = models.IntegerField(default=0)

    tackles = models.IntegerField(default=0)
    sacks = models.FloatField(default=0.0)
    interceptions = models.IntegerField(default=0)

    fumbles_forced = models.IntegerField(default=0)
    fumbles_recovered = models.IntegerField(default=0)

    field_goals_made = models.IntegerField(default=0)
    field_goals_attempted = models.IntegerField(default=0)

    extra_points_made = models.IntegerField(default=0)
    extra_points_attempted = models.IntegerField(default=0)


class Games(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="games")
    teamA = models.ForeignKey(
        Teams, on_delete=models.CASCADE, related_name="games_as_teamA"
    )
    teamB = models.ForeignKey(
        Teams, on_delete=models.CASCADE, related_name="games_as_teamB"
    )
    winner = models.ForeignKey(
        Teams, on_delete=models.CASCADE, null=True, related_name="games_as_winner"
    )
    labelA = models.CharField(max_length=50)
    labelB = models.CharField(max_length=50)
    spreadA = models.CharField(max_length=50)
    spreadB = models.CharField(max_length=50)
    moneylineA = models.CharField(max_length=50)
    moneylineB = models.CharField(max_length=50)
    winProbA = models.FloatField()
    winProbB = models.FloatField()
    weekPlayed = models.IntegerField()
    rankATOG = models.IntegerField()
    rankBTOG = models.IntegerField()
    resultA = models.CharField(max_length=50, null=True)
    resultB = models.CharField(max_length=50, null=True)
    overtime = models.IntegerField()
    scoreA = models.IntegerField(null=True)
    scoreB = models.IntegerField(null=True)


class Conferences(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="conferences")
    confName = models.CharField(max_length=255)
    confFullName = models.CharField(max_length=255)
    confGames = models.IntegerField()
    championship = models.ForeignKey(Games, on_delete=models.CASCADE, null=True)


class Odds(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="odds")
    diff = models.IntegerField()
    favSpread = models.CharField(max_length=10)
    udSpread = models.CharField(max_length=10)
    favWinProb = models.FloatField()
    udWinProb = models.FloatField()
    favMoneyline = models.CharField(max_length=10)
    udMoneyline = models.CharField(max_length=10)


class Drives(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="drives")
    game = models.ForeignKey(Games, on_delete=models.CASCADE, related_name="drives")
    driveNum = models.IntegerField()
    offense = models.ForeignKey(
        Teams, on_delete=models.CASCADE, related_name="drives_as_offense"
    )
    defense = models.ForeignKey(
        Teams, on_delete=models.CASCADE, related_name="drives_as_defense"
    )
    startingFP = models.IntegerField()
    result = models.CharField(max_length=50)
    points = models.IntegerField()


class Plays(models.Model):
    class Meta:
        ordering = ["id"]

    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="plays")
    game = models.ForeignKey(Games, on_delete=models.CASCADE, related_name="plays")
    drive = models.ForeignKey(Drives, on_delete=models.CASCADE, related_name="plays")
    offense = models.ForeignKey(
        Teams, on_delete=models.CASCADE, related_name="plays_as_offense"
    )
    defense = models.ForeignKey(
        Teams, on_delete=models.CASCADE, related_name="plays_as_defense"
    )
    startingFP = models.IntegerField()
    down = models.IntegerField()
    yardsLeft = models.IntegerField()
    playType = models.CharField(max_length=50)
    yardsGained = models.IntegerField()
    result = models.CharField(max_length=50)
    text = models.CharField(max_length=255, null=True)


class Playoff(models.Model):
    info = models.ForeignKey(
        Info, on_delete=models.CASCADE, related_name="playoffs_info"
    )
    teams = models.IntegerField()
    autobids = models.IntegerField()

    seed_1 = models.ForeignKey(
        Teams, on_delete=models.CASCADE, null=True, related_name="seed_1"
    )
    seed_2 = models.ForeignKey(
        Teams, on_delete=models.CASCADE, null=True, related_name="seed_2"
    )
    seed_3 = models.ForeignKey(
        Teams, on_delete=models.CASCADE, null=True, related_name="seed_3"
    )
    seed_4 = models.ForeignKey(
        Teams, on_delete=models.CASCADE, null=True, related_name="seed_4"
    )

    left_r1_1 = models.ForeignKey(
        Games, on_delete=models.CASCADE, null=True, related_name="left_r1_1"
    )
    left_r1_2 = models.ForeignKey(
        Games, on_delete=models.CASCADE, null=True, related_name="left_r1_2"
    )
    right_r1_1 = models.ForeignKey(
        Games, on_delete=models.CASCADE, null=True, related_name="right_r1_1"
    )
    right_r1_2 = models.ForeignKey(
        Games, on_delete=models.CASCADE, null=True, related_name="right_r1_2"
    )

    left_quarter_1 = models.ForeignKey(
        Games,
        on_delete=models.CASCADE,
        null=True,
        related_name="left_quarter_1",
    )
    left_quarter_2 = models.ForeignKey(
        Games,
        on_delete=models.CASCADE,
        null=True,
        related_name="left_quarter_2",
    )
    right_quarter_1 = models.ForeignKey(
        Games,
        on_delete=models.CASCADE,
        null=True,
        related_name="right_quarter_1",
    )
    right_quarter_2 = models.ForeignKey(
        Games,
        on_delete=models.CASCADE,
        null=True,
        related_name="right_quarter_2",
    )

    left_semi = models.ForeignKey(
        Games, on_delete=models.CASCADE, null=True, related_name="left_semi"
    )
    right_semi = models.ForeignKey(
        Games, on_delete=models.CASCADE, null=True, related_name="right_semi"
    )

    natty = models.ForeignKey(
        Games, on_delete=models.CASCADE, null=True, related_name="pnatty"
    )
