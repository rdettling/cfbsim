from django.urls import path
from . import views

urlpatterns = [
    path("", views.recruiting),
    path("offer/<int:id>", views.offer),
    path("add_points/<int:id>", views.points),
]
