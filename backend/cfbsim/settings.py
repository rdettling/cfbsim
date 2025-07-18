from pathlib import Path
import os
import dj_database_url
from dotenv import load_dotenv

# Get the project root directory (two levels up from settings.py)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

# Core Settings
# Use environment variable with a default value
DEV = os.environ.get("DJANGO_ENV", "development") == "development"
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("SECRET_KEY")
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost 127.0.0.1").split(" ")

# Debug and Database Settings
if DEV:
    DEBUG = True
    SECURE_SSL_REDIRECT = False
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

    STATICFILES_DIRS = [
        os.path.join(BASE_DIR.parent, "frontend/public"),  # Development static files
    ]
else:
    DEBUG = False
    SECURE_SSL_REDIRECT = True
    DATABASES = {
        "default": dj_database_url.config(
            default=os.environ.get("HEROKU_POSTGRESQL_CYAN_URL"),
            ssl_require=os.environ.get("SSL_REQUIRE"),
        )
    }

    STATICFILES_DIRS = [
        os.path.join(BASE_DIR.parent, "frontend/dist"),
    ]


# Security Settings
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_COOKIE_AGE = 1209600  # 2 weeks, in seconds

# Application Definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "django.contrib.messages",
    "api",
    "recruit",
    "rest_framework",
    "corsheaders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# URL Configuration
ROOT_URLCONF = "cfbsim.urls"

# CORS Settings
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://cfbsim.net",  # Add your Heroku domain
]

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-user-id",
]

CORS_ALLOWED_HEADERS = CORS_ALLOW_HEADERS  # Both settings are needed for some versions

# Templates
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            os.path.join(BASE_DIR, "templates"),  # For copied index.html
            os.path.join(BASE_DIR.parent, "frontend/dist"),  # For direct access to dist
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# WSGI Application
WSGI_APPLICATION = "cfbsim.wsgi.application"

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static Files
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
YEARS_DATA_DIR = BASE_DIR / "data" / "years"

STATICFILES_FINDERS = [
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
]

# Default Primary Key Field Type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# REST Framework Settings
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ]
}

# Use a simpler storage backend to avoid potential issues
STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"
