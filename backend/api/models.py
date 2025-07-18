from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
import time


class Info(models.Model):
    user_id = models.CharField(max_length=255, primary_key=True)
    currentWeek = models.IntegerField(null=True)
    currentYear = models.IntegerField(null=True)
    startYear = models.IntegerField(null=True)
    lastWeek = models.IntegerField(null=True)
    team = models.ForeignKey(
        "Teams", on_delete=models.SET_NULL, null=True, related_name="infos"
    )
    playoff = models.ForeignKey(
        "Playoff", on_delete=models.SET_NULL, related_name="infos", null=True
    )
    stage = models.CharField(null=True, max_length=50)


class Teams(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=50)
    abbreviation = models.CharField(max_length=4)
    prestige = models.IntegerField()
    rating = models.IntegerField(null=True)
    offense = models.IntegerField(null=True)
    defense = models.IntegerField(null=True)
    mascot = models.CharField(max_length=50)
    colorPrimary = models.CharField(max_length=7)
    colorSecondary = models.CharField(max_length=7)
    conference = models.ForeignKey(
        "Conferences", on_delete=models.CASCADE, related_name="teams", null=True
    )
    confGames = models.IntegerField(default=0)
    confLimit = models.IntegerField()
    confWins = models.IntegerField(default=0)
    confLosses = models.IntegerField(default=0)
    nonConfGames = models.IntegerField(default=0)
    nonConfLimit = models.IntegerField()
    nonConfWins = models.IntegerField(default=0)
    nonConfLosses = models.IntegerField(default=0)
    gamesPlayed = models.IntegerField(default=0)
    totalWins = models.IntegerField(default=0)
    totalLosses = models.IntegerField(default=0)
    resume_total = models.FloatField(default=0)
    resume = models.FloatField(default=0)
    ranking = models.IntegerField(null=True)
    last_rank = models.IntegerField(null=True)
    offers = models.IntegerField()
    recruiting_points = models.IntegerField()


class Players(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="players")
    team = models.ForeignKey(Teams, on_delete=models.CASCADE, related_name="players")
    first = models.CharField(max_length=50)
    last = models.CharField(max_length=50)
    year = models.CharField(max_length=2)
    pos = models.CharField(max_length=2)
    rating = models.IntegerField()
    rating_fr = models.IntegerField()
    rating_so = models.IntegerField()
    rating_jr = models.IntegerField()
    rating_sr = models.IntegerField()
    stars = models.IntegerField()
    development_trait = models.IntegerField()
    starter = models.BooleanField()


class Years(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="years")
    team = models.ForeignKey(Teams, on_delete=models.CASCADE, related_name="years")
    year = models.IntegerField()
    prestige = models.IntegerField()
    rating = models.IntegerField()
    wins = models.IntegerField()
    losses = models.IntegerField()
    rank = models.IntegerField()
    conference = models.CharField(max_length=50)


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
    base_label = models.CharField(max_length=50)
    name = models.CharField(max_length=50, null=True)
    spreadA = models.CharField(max_length=10)
    spreadB = models.CharField(max_length=10)
    moneylineA = models.CharField(max_length=10)
    moneylineB = models.CharField(max_length=10)
    winProbA = models.FloatField()
    winProbB = models.FloatField()
    weekPlayed = models.IntegerField()
    year = models.IntegerField()
    rankATOG = models.IntegerField()
    rankBTOG = models.IntegerField()
    resultA = models.CharField(max_length=1, null=True)
    resultB = models.CharField(max_length=1, null=True)
    overtime = models.IntegerField(default=0)
    scoreA = models.IntegerField(null=True)
    scoreB = models.IntegerField(null=True)
    headline = models.CharField(max_length=255, null=True)


class Conferences(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="conferences")
    confName = models.CharField(max_length=50)
    confFullName = models.CharField(max_length=50)
    confGames = models.IntegerField()
    championship = models.ForeignKey(Games, on_delete=models.SET_NULL, null=True)


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
    points_needed = models.IntegerField()
    scoreAAfter = models.IntegerField()
    scoreBAfter = models.IntegerField()


class Plays(models.Model):
    class Meta:
        ordering = ["id"]

    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="plays")
    game = models.ForeignKey(Games, on_delete=models.CASCADE, related_name="plays")
    drive = models.ForeignKey(
        Drives, on_delete=models.CASCADE, related_name="plays", null=True
    )
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
    text = models.CharField(max_length=100, null=True)
    header = models.CharField(max_length=100, null=True)
    scoreA = models.IntegerField()
    scoreB = models.IntegerField()
    next_play_id = models.IntegerField(null=True)


class Playoff(models.Model):
    info = models.ForeignKey(
        Info, on_delete=models.CASCADE, related_name="playoff_info"
    )
    teams = models.IntegerField()
    autobids = models.IntegerField()
    conf_champ_top_4 = models.BooleanField(default=False)

    seed_1 = models.ForeignKey(
        Teams, on_delete=models.SET_NULL, null=True, related_name="seed_1"
    )
    seed_2 = models.ForeignKey(
        Teams, on_delete=models.SET_NULL, null=True, related_name="seed_2"
    )
    seed_3 = models.ForeignKey(
        Teams, on_delete=models.SET_NULL, null=True, related_name="seed_3"
    )
    seed_4 = models.ForeignKey(
        Teams, on_delete=models.SET_NULL, null=True, related_name="seed_4"
    )

    left_r1_1 = models.ForeignKey(
        Games, on_delete=models.SET_NULL, null=True, related_name="left_r1_1"
    )
    left_r1_2 = models.ForeignKey(
        Games, on_delete=models.SET_NULL, null=True, related_name="left_r1_2"
    )
    right_r1_1 = models.ForeignKey(
        Games, on_delete=models.SET_NULL, null=True, related_name="right_r1_1"
    )
    right_r1_2 = models.ForeignKey(
        Games, on_delete=models.SET_NULL, null=True, related_name="right_r1_2"
    )

    left_quarter_1 = models.ForeignKey(
        Games,
        on_delete=models.SET_NULL,
        null=True,
        related_name="left_quarter_1",
    )
    left_quarter_2 = models.ForeignKey(
        Games,
        on_delete=models.SET_NULL,
        null=True,
        related_name="left_quarter_2",
    )
    right_quarter_1 = models.ForeignKey(
        Games,
        on_delete=models.SET_NULL,
        null=True,
        related_name="right_quarter_1",
    )
    right_quarter_2 = models.ForeignKey(
        Games,
        on_delete=models.SET_NULL,
        null=True,
        related_name="right_quarter_2",
    )

    left_semi = models.ForeignKey(
        Games, on_delete=models.SET_NULL, null=True, related_name="left_semi"
    )
    right_semi = models.ForeignKey(
        Games, on_delete=models.SET_NULL, null=True, related_name="right_semi"
    )

    natty = models.ForeignKey(
        Games, on_delete=models.SET_NULL, null=True, related_name="natty"
    )


class Recruits(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="recruits")
    first = models.CharField(max_length=50)
    last = models.CharField(max_length=50)
    pos = models.CharField(max_length=2)
    overall_rank = models.IntegerField()
    state_rank = models.IntegerField()
    position_rank = models.IntegerField()
    stars = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    state = models.CharField(max_length=2)
    min_prestige = models.IntegerField()
    committed_team = models.ForeignKey(
        Teams, on_delete=models.SET_NULL, null=True, related_name="committed_recruits"
    )

    def top_offer(self):
        top_offer = self.offers.order_by("-interest_level").first()
        return top_offer.team if top_offer else None

    def top_three_offers(self):
        return self.offers.order_by("-interest_level")[:3]


class Offers(models.Model):
    info = models.ForeignKey(Info, on_delete=models.CASCADE, related_name="offers")
    recruit = models.ForeignKey(
        Recruits, on_delete=models.CASCADE, related_name="offers"
    )
    team = models.ForeignKey(
        Teams, on_delete=models.CASCADE, related_name="extended_offers"
    )
    interest_level = models.IntegerField(default=0)

    class Meta:
        unique_together = ["recruit", "team"]
