from django.db import models

class Teams(models.Model):
    name = models.CharField(max_length=255)
    abbreviation = models.CharField(max_length=10)
    prestige = models.IntegerField()
    rating = models.IntegerField()
    mascot = models.CharField(max_length=255)
    colorPrimary = models.CharField(max_length=7)
    colorSecondary = models.CharField(max_length=7)
    conference = models.CharField(max_length=255, null=True)
    confWins = models.IntegerField()
    confLosses = models.IntegerField()
    nonConfWins = models.IntegerField()
    nonConfLosses = models.IntegerField()
    totalWins = models.IntegerField()
    totalLosses = models.IntegerField()
    resume = models.FloatField()
    expectedWins = models.FloatField()
    ranking = models.IntegerField()

class Conferences(models.Model):
    confName = models.CharField(max_length=255)
    confFullName = models.CharField(max_length=10)
    confGames = models.IntegerField()

class Games(models.Model):
    gameID = models.IntegerField()
    team = models.CharField(max_length=255)
    opponent = models.CharField(max_length=255)
    label = models.CharField(max_length=255, null=True)
    spread = models.CharField(max_length=10)
    moneyline = models.CharField(max_length=10)
    winProb = models.FloatField()
    weekPlayed = models.IntegerField()
    gameNum = models.IntegerField()
    result = models.CharField(max_length=10)
    score = models.CharField(max_length=10, null=True)

class Weeks(models.Model):
    currentWeek = models.IntegerField()

class Drives(models.Model):
    gameID = models.IntegerField()
    driveID = models.IntegerField()
    offense = models.CharField(max_length=255)
    defense = models.CharField(max_length=255)
    startingFP = models.IntegerField()
    result = models.CharField(max_length=255)
    yards = models.IntegerField()
    playCount = models.IntegerField()
    points = models.IntegerField()

class Plays(models.Model):
    gameID = models.IntegerField()
    driveID = models.IntegerField()
    offense = models.CharField(max_length=255)
    defense = models.CharField(max_length=255)
    startingFP = models.IntegerField()
    down = models.IntegerField()
    yardsLeft = models.IntegerField()
    playType = models.CharField(max_length=255)
    yardsGained = models.IntegerField()
    result = models.CharField(max_length=255)
