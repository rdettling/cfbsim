from django.urls import path
from . import views

urlpatterns = [
    path("<str:team_name>/schedule", views.schedule),
    path("<str:team_name>/roster", views.roster),
    path("<str:team_name>/roster/<int:id>", views.player, name="player"),
    path("<str:team_name>/stats", views.stats),
]
