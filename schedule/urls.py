from django.urls import path
from . import views

urlpatterns = [
    path('<int:week_num>.html', views.schedule),
]