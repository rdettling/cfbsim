from django.urls import path
from . import views

urlpatterns = [
    path('team.html', views.teamstats),
    path('individual/<str:category>.html', views.individualstats),
]