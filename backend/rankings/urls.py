from django.urls import path
from . import views

urlpatterns = [
    path("", views.rankings),
    path("<str:conference_name>", views.standings),
]
