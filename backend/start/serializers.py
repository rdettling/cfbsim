from rest_framework import serializers
from .models import *
from util.util import format_record


class TeamsSerializer(serializers.ModelSerializer):
    conference = serializers.SerializerMethodField()
    record = serializers.SerializerMethodField()

    class Meta:
        model = Teams
        fields = [
            "name",
            "abbreviation",
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
        fields = "__all__"


class PlayersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Players
        fields = "__all__"


class DrivesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Drives
        fields = "__all__"


class PlaysSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plays
        fields = "__all__"


class GameLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameLog
        fields = "__all__"


class YearsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Years
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


class InfoSerializer(serializers.ModelSerializer):
    team = TeamsSerializer(read_only=True)

    class Meta:
        model = Info
        fields = "__all__"


class ConferenceNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conferences
        fields = ["id", "confName"]


class TeamNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teams
        fields = ["name"]


class GamesSerializer(serializers.ModelSerializer):
    teamA = TeamNameSerializer()
    teamB = TeamNameSerializer()

    class Meta:
        model = Games
        fields = "__all__"
