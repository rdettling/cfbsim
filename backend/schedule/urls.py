from django.urls import path
from . import views

urlpatterns = [
    path("<int:week_num>", views.schedule),
    path("playoff", views.playoff),
]
