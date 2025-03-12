from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("start.urls")),
    # path("recruit/", include("recruit.urls")),
    
    # This catch-all pattern will serve index.html for any route not matched above
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html')),
]
