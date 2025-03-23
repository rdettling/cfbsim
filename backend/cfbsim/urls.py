from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from cfbsim.settings import DEV
from django.http import HttpResponse


def health_check(request):
    return HttpResponse("Server is running")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("start.urls")),
    path("health/", health_check),
    # path("recruit/", include("recruit.urls")),
]

# Only add the catch-all route in production
if not DEV:
    # Make this its own separate pattern list to ensure proper ordering
    urlpatterns += [
        re_path(r"^.*$", TemplateView.as_view(template_name="index.html"))
    ]
