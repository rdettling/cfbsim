from django.urls import path
from . import views

urlpatterns = [
    path("top25", views.rankings),
    path("<str:conference_name>", views.standings),
]
