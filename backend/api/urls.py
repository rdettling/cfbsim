from django.urls import path
from .views.info_views import home, dashboard, settings
from .views.schedule_views import fetch_teams, schedule_nc, week_schedule
from .views.season_views import (
    rankings,
    standings,
    playoff,
    advance_week,
    live_sim,
    get_games_to_live_sim,
)
from .views.stages_views import (
    season_summary,
    roster_progression,
    recruiting_summary,
    noncon,
    realignment_view,
    update_realignment_settings,
)
from .views.team_views import team_info, team_schedule, roster, history, player
from .views.game_views import game
from .views.stats_views import team_stats, individual_stats, ratings_stats
from .views.award_views import awards, awards_status

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
    path("sim/<int:dest_week>/", advance_week),
    path("live-sim-games/", get_games_to_live_sim),
    path("game/<int:game_id>/live-sim/", live_sim),
    path("roster_progression/", roster_progression),
    path("recruiting_summary/", recruiting_summary),
    path("summary/", season_summary),
    path("realignment/", realignment_view),
    path("realignment/update/", update_realignment_settings),
    path("settings/", settings),
    path("awards/", awards),
    path("awards/status/", awards_status),
]
