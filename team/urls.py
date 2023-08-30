from django.urls import path
from . import views

urlpatterns = [
    path('<str:team_name>/schedule.html', views.schedule),
    path('<str:team_name>/schedule/<int:game_num>.html', views.details, name='details'),
    path('<str:team_name>/roster.html', views.roster),
    path('<str:team_name>/roster/<int:id>.html', views.player, name='player'),
    path('<str:team_name>/stats.html', views.stats),
    path('<str:team_name>/<int:weeks>/sim.html', views.simWeek)
]