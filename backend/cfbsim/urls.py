from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("start.urls")),
    path("teams/", include("team.urls")),
    path("stats/", include("stats.urls")),
    path("schedule/", include("schedule.urls")),
    path("recruit/", include("recruit.urls")),
]
