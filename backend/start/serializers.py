from rest_framework import serializers
from .models import *

class TeamsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teams
        fields = '__all__'

class PlayoffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Playoff
        fields = '__all__'

class ConferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conferences
        fields = '__all__'

class PlayersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Players
        fields = '__all__'

class GamesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Games
        fields = '__all__'

class DrivesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Drives
        fields = '__all__'

class PlaysSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plays
        fields = '__all__'

class GameLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameLog
        fields = '__all__'

class YearsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Years
        fields = '__all__'

class RecruitsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recruits
        fields = '__all__'

class OffersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offers
        fields = '__all__'

class OddsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Odds
        fields = '__all__'

class InfoSerializer(serializers.ModelSerializer):
    # team = TeamsSerializer()
    # playoff = PlayoffSerializer()
    # teams = TeamsSerializer(many=True, read_only=True)
    # conferences = ConferencesSerializer(many=True, read_only=True)
    # games = GamesSerializer(many=True, read_only=True)
    # plays = PlaysSerializer(many=True, read_only=True)
    # players = PlayersSerializer(many=True, read_only=True)
    # years = YearsSerializer(many=True, read_only=True)
    # recruits = RecruitsSerializer(many=True, read_only=True)
    # offers = OffersSerializer(many=True, read_only=True)
    # odds = OddsSerializer(many=True, read_only=True)
    # drives = DrivesSerializer(many=True, read_only=True)
    # game_logs = GameLogSerializer(many=True, read_only=True)

    class Meta:
        model = Info
        fields = '__all__'