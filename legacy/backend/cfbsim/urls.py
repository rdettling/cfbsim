from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from cfbsim.settings import DEV
from django.http import HttpResponse, JsonResponse
from django.conf import settings
import os


def health_check(request):
    return HttpResponse("Server is running")


def debug_static_files(request):
    """Debug endpoint to check static files configuration"""
    # Collect basic info
    result = {
        "environment": "production" if not DEV else "development",
        "STATIC_URL": settings.STATIC_URL,
        "STATIC_ROOT": settings.STATIC_ROOT,
        "STATICFILES_DIRS": [str(d) for d in settings.STATICFILES_DIRS],
        "files": {"static_root": [], "staticfiles_dirs": {}},
    }

    # Scan STATIC_ROOT
    if os.path.exists(settings.STATIC_ROOT):
        for root, _, files in os.walk(settings.STATIC_ROOT):
            for file in files:
                rel_path = os.path.relpath(
                    os.path.join(root, file), settings.STATIC_ROOT
                )
                result["files"]["static_root"].append(rel_path)

    # Scan STATICFILES_DIRS
    for i, static_dir in enumerate(settings.STATICFILES_DIRS):
        dir_name = os.path.basename(static_dir)
        result["files"]["staticfiles_dirs"][f"{i}_{dir_name}"] = []

        if os.path.exists(static_dir):
            for root, _, files in os.walk(static_dir):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), static_dir)
                    result["files"]["staticfiles_dirs"][f"{i}_{dir_name}"].append(
                        rel_path
                    )

    # Also check logos specifically - this is what we're most interested in
    logo_count = 0
    logo_paths = []

    for dir_path in settings.STATICFILES_DIRS:
        logos_dir = os.path.join(dir_path, "logos", "teams")
        if os.path.exists(logos_dir):
            for _, _, files in os.walk(logos_dir):
                for file in files:
                    if file.endswith(".png"):
                        logo_count += 1
                        logo_paths.append(f"logos/teams/{file}")

    result["logo_count"] = logo_count
    result["logo_paths"] = logo_paths[:10]  # Show first 10 logos only to avoid overload

    return JsonResponse(result)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    path("health/", health_check),
    path("debug/static/", debug_static_files),  # New debug endpoint
    # path("recruit/", include("recruit.urls")),
]

# Only add the catch-all route in production
if not DEV:
    # Make this its own separate pattern list to ensure proper ordering
    urlpatterns += [re_path(r"^.*$", TemplateView.as_view(template_name="index.html"))]
