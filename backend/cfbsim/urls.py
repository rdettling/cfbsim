from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from cfbsim.settings import DEV

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("start.urls")),
    # path("recruit/", include("recruit.urls")),
]

# Only add the catch-all route in production
if not DEV:
    urlpatterns.append(
        re_path(r'^.*$', TemplateView.as_view(template_name='index.html'))
    )