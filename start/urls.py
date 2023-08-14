from django.urls import path
from . import views

urlpatterns = [
    path('', views.launch),
    path('pickteam.html', views.start, name='pickteam'),
]