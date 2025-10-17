from django.urls import path
from .views.info_views import home, dashboard
from .views.schedule_views import fetch_teams, schedule_nc, week_schedule
from .views.season_views import (
    rankings,
    standings,
    playoff,
    sim,
    live_sim,
    live_sim_games,
)
from .views.stages_views import (
    season_summary,
    roster_progression,
    recruiting_summary,
    noncon,
)
from .views.team_views import team_info, team_schedule, roster, history, player
from .views.game_views import game
from .views.stats_views import team_stats, individual_stats, ratings_stats

urlpatterns = [
    path("home/", home),
    path("noncon/", noncon),
    path("fetchteams/", fetch_teams),
    path("schedulenc/", schedule_nc),
    path("dashboard/", dashboard),
    path("team_info/", team_info),
    path("<str:team_name>/schedule/", team_schedule),
    path("rankings/", rankings),
    path("standings/<str:conference_name>/", standings),
    path("<str:team_name>/roster/", roster),
    path("<str:team_name>/history/", history),
    path("player/<int:id>/", player),
    path("week/<int:week_num>/", week_schedule),
    path("playoff/", playoff),
    path("game/<int:id>/", game),
    path("stats/team/", team_stats),
    path("stats/individual/", individual_stats),
    path("stats/ratings/", ratings_stats),
    path("sim/<int:dest_week>/", sim),
    path("live-sim-games/", live_sim_games),
    path("game/<int:game_id>/live-sim/", live_sim),
    # path("fetch_play/", views.fetch_play, name="fetch_play"),
    path("roster_progression/", roster_progression),
    path("recruiting_summary/", recruiting_summary),
    path("summary/", season_summary),
]
