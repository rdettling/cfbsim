from django.urls import path
from . import views

urlpatterns = [
    path("api/home/", views.home),  
    path("noncon/", views.noncon, name="noncon"),
    path("fetchteams/", views.fetch_teams, name="fetch_teams"),
    path("fetch_play/", views.fetch_play, name="fetch_play"),
    path("schedulenc/", views.schedulenc, name="schedulenc"),
    path("games/<int:id>/", views.game, name="game"),
    path("sim/", views.simWeek),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("roster_progression/", views.roster_progression, name="roster progression"),
    path("season_summary/", views.season_summary, name="season summary"),
]
