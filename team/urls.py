from django.urls import path
from . import views

urlpatterns = [
    path('<str:team>/schedule.html', views.schedule),
    path('<str:team>/schedule/<int:number>.html', views.details),
    path('<str:team>/roster.html', views.roster),
    path('<str:team>/roster/<int:number>.html', views.player),
    path('<str:team>/stats.html', views.stats),
    path('<str:team>/sim.html', views.simWeek)
]