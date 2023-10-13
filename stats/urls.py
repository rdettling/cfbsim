from django.urls import path
from . import views

urlpatterns = [
    path("team", views.teamstats),
    path("individual/<str:category>", views.individualstats),
]
