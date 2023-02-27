from django.urls import path
from . import views

urlpatterns = [
    path('<str:team>', views.teampage),
    path('<str:team>/sim.html', views.sim),
    path('<str:team>/<int:number>.html', views.details),
]