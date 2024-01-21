from django.urls import path
from . import views

urlpatterns = [
    path("team", views.team_stats),
    path("individual", views.stat_categories),
    path("individual/<str:category>", views.individual_stats, name="individual"),
]
