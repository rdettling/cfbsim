from django.urls import path
from . import views

urlpatterns = [
    path("api/home/", views.home),
    path("api/noncon/", views.noncon),
    path("api/fetchteams/", views.fetch_teams),
    path("api/schedulenc/", views.schedule_nc),
    path("api/dashboard/", views.dashboard),
    path("api/team_info/", views.team_info),
    path("api/<str:team_name>/schedule/", views.schedule),
    path("api/rankings/", views.rankings),
    path("api/standings/<str:conference_name>", views.standings),
    path("api/<str:team_name>/roster/", views.roster),
    path("api/<str:team_name>/history/", views.history),
    path("api/player/<int:id>/", views.player),
    path("api/week/<int:week_num>", views.week_schedule),
    path("api/playoff/", views.playoff),
    path("api/game/<int:id>/", views.game),
    path("api/team_stats/", views.team_stats),
    path("api/individual_stats/", views.individual_stats),
    path("api/sim/", views.simWeek),
    # path("fetch_play/", views.fetch_play, name="fetch_play"),
    # path("games/<int:id>/", views.game, name="game"),
    # path("sim/", views.simWeek),
    # path("roster_progression/", views.roster_progression, name="roster progression"),
    # path("season_summary/", views.season_summary, name="season summary"),
]
