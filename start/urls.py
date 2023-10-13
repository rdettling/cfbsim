from django.urls import path
from . import views

urlpatterns = [
    path("", views.launch, name="launch"),
    path("preview", views.preview, name="preview"),
    path("pickteam", views.pickteam, name="pickteam"),
    path("noncon", views.noncon, name="noncon"),
    path("fetchteams/", views.fetch_teams, name="fetch_teams"),
    path("schedulenc/", views.schedulenc, name="schedulenc"),
]
