from django.urls import path
from . import views

urlpatterns = [
    path('top25.html', views.rankings),
    path('<str:conference_name>.html', views.standings),
]