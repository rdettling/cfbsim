from django.urls import path
from . import views

urlpatterns = [
    path("home/", views.home),
    path("noncon/", views.noncon),
    path("fetchteams/", views.fetch_teams),
    path("schedulenc/", views.schedule_nc),
    path("dashboard/", views.dashboard),
    path("team_info/", views.team_info),
    path("<str:team_name>/schedule/", views.schedule),
    path("rankings/", views.rankings),
    path("standings/<str:conference_name>/", views.standings),
    path("<str:team_name>/roster/", views.roster),
    path("<str:team_name>/history/", views.history),
    path("player/<int:id>/", views.player),
    path("week/<int:week_num>/", views.week_schedule),
    path("playoff/", views.playoff),
    path("game/<int:id>/", views.game),
    path("team_stats/", views.team_stats),
    path("individual_stats/", views.individual_stats),
    path("sim/<int:dest_week>/", views.sim),
    # path("fetch_play/", views.fetch_play, name="fetch_play"),
    path("roster_progression/", views.roster_progression),
    path("summary/", views.season_summary),
]
