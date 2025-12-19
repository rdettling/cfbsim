from rest_framework import serializers
from .models import *
from logic.util import format_record


class TeamsSerializer(serializers.ModelSerializer):
    conference = serializers.SerializerMethodField()
    record = serializers.SerializerMethodField()

    class Meta:
        model = Teams
        fields = [
            "name",
            "conference",
            "ranking",
            "prestige",
            "rating",
            "record",
            "nonConfGames",
            "nonConfLimit",
            "confWins",
            "confLosses",
            "totalWins",
            "totalLosses",
            "offense",
            "defense",
            "colorPrimary",
            "colorSecondary",
        ]

    def get_conference(self, obj):
        return obj.conference.confName if obj.conference else "Independent"

    def get_record(self, obj):
        return format_record(obj)


class PlayoffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Playoff
        fields = "__all__"


class ConferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conferences
        fields = ["id", "confName"]

    def to_representation(self, instance):
        return {instance.confName: instance.id}


class PlayersSerializer(serializers.ModelSerializer):
    change = serializers.IntegerField(read_only=True, required=False)
    team = serializers.SerializerMethodField()

    class Meta:
        model = Players
        fields = "__all__"

    def get_team(self, obj):
        return obj.team.name if obj.team else None


class PlaysSerializer(serializers.ModelSerializer):
    """Serializer for individual plays"""

    class Meta:
        model = Plays
        fields = [
            "id",
            "down",
            "yardsLeft",
            "startingFP",
            "playType",
            "yardsGained",
            "result",
            "text",
            "header",
            "scoreA",
            "scoreB",
        ]


class DrivesSerializer(serializers.ModelSerializer):
    """Serializer for drives with nested plays"""

    plays = PlaysSerializer(many=True, read_only=True)
    offense = serializers.CharField(source="offense.name", read_only=True)
    defense = serializers.CharField(source="defense.name", read_only=True)
    yards = serializers.SerializerMethodField()

    class Meta:
        model = Drives
        fields = [
            "driveNum",
            "offense",
            "defense",
            "startingFP",
            "result",
            "points",
            "yards",
            "plays",
            "scoreAAfter",
            "scoreBAfter",
        ]

    def get_yards(self, obj):
        """Calculate total yards gained for this drive"""
        return sum(play.yardsGained for play in obj.plays.all())


class GameLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameLog
        fields = "__all__"


class YearsSerializer(serializers.ModelSerializer):
    class Meta:
        model = History
        fields = "__all__"


class RecruitsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recruits
        fields = "__all__"


class OffersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offers
        fields = "__all__"


class OddsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Odds
        fields = "__all__"


class TeamSimpleSerializer(serializers.ModelSerializer):
    record = serializers.SerializerMethodField()

    class Meta:
        model = Teams
        fields = ["name", "record", "colorPrimary", "colorSecondary"]

    def get_record(self, obj):
        return format_record(obj)


class InfoSerializer(serializers.ModelSerializer):
    team = serializers.SerializerMethodField()
    colorPrimary = serializers.SerializerMethodField()
    colorSecondary = serializers.SerializerMethodField()

    class Meta:
        model = Info
        fields = "__all__"

    def get_team(self, obj):
        return obj.team.name if obj.team else None

    def get_colorPrimary(self, obj):
        return obj.team.colorPrimary if obj.team else None

    def get_colorSecondary(self, obj):
        return obj.team.colorSecondary if obj.team else None


class GamesSerializer(serializers.ModelSerializer):
    teamA = TeamSimpleSerializer()
    teamB = TeamSimpleSerializer()

    class Meta:
        model = Games
        fields = "__all__"


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settings
        fields = [
            "playoff_teams",
            "playoff_autobids",
            "playoff_conf_champ_top_4",
            "auto_realignment",
            "auto_update_postseason_format"
        ]

