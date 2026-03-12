# exam-sync-v2/backend/backend/settings.py
# NOTE: See url.py output file for the updated urls.py with health check endpoint

from pathlib import Path
import os
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

# ──────────────────────────────────────────────
# SECURITY / ENVIRONMENT SETTINGS
# ──────────────────────────────────────────────
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
FRONTEND_URL = config('FRONTEND_URL', default="https://exam-sync-v2-0-lkat.onrender.com")

ALLOWED_HOSTS = [
    "exam-sync-v2-0-lkat.onrender.com",
    "exam-sync-v2-0-mwnp.onrender.com",
    "localhost",
    "127.0.0.1",
    "www.examsyncv2.com",
]

# ──────────────────────────────────────────────
# INSTALLED APPS
# ──────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",

    # Local
    "api",
]

# ──────────────────────────────────────────────
# MIDDLEWARE
# ──────────────────────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # Must be before CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ──────────────────────────────────────────────
# CORS / CSRF CONFIG
# ──────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "https://exam-sync-v2-0-lkat.onrender.com",
    "https://exam-sync-v2-0-mwnp.onrender.com",
    "https://www.examsyncv2.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
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
]

CORS_PREFLIGHT_MAX_AGE = 86400
CORS_EXPOSE_HEADERS = ['Content-Type', 'X-CSRFToken']

CSRF_TRUSTED_ORIGINS = [
    "https://exam-sync-v2-0-lkat.onrender.com",
    "https://exam-sync-v2-0-mwnp.onrender.com",
    "https://www.examsyncv2.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# ──────────────────────────────────────────────
# URL / WSGI
# ──────────────────────────────────────────────
ROOT_URLCONF = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"

REDIS_URL = config('REDIS_URL', default=None)

if REDIS_URL:
    # ✅ Best option: Upstash Redis — persists across cold starts, free tier available
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "SOCKET_CONNECT_TIMEOUT": 5,
                "SOCKET_TIMEOUT": 5,
                "IGNORE_EXCEPTIONS": True,  # Fallback gracefully if Redis is unavailable
            },
            "KEY_PREFIX": "examsync",
            "TIMEOUT": 300,  # 5 minutes default cache timeout
        }
    }
    # Use Redis for session storage too (faster than DB)
    SESSION_ENGINE = "django.contrib.sessions.backends.cache"
    SESSION_CACHE_ALIAS = "default"
else:
    # ✅ Fallback: Filesystem cache — survives within the same Render instance session
    # Better than LocMemCache which wipes on every cold start process
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
            "LOCATION": "/tmp/django_cache",
            "TIMEOUT": 300,
            "OPTIONS": {
                "MAX_ENTRIES": 1000,
            },
        }
    }
    # Fallback session engine
    SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"

# ──────────────────────────────────────────────
# DATABASE CONFIGURATION
# ──────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST"),
        "PORT": config("DB_PORT", cast=int),
        "CONN_MAX_AGE": 600,
        "CONN_HEALTH_CHECKS": True,  # Reuse DB connections for 10 minutes
        "OPTIONS": {
            "application_name": "DjangoApp",
            "sslmode": "require",
            "connect_timeout": 5,       # Reduced from 10 → faster fail/retry on cold start
            # TCP keepalives prevent stale connections from being dropped by the DB proxy
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 5,
            "keepalives_count": 5,
        },
    }
}

# ──────────────────────────────────────────────
# DJANGO REST FRAMEWORK SETTINGS
# ──────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 30,
    # ✅ Drop BrowsableAPIRenderer in production — saves memory and response time
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ] if not config('DEBUG', default=False, cast=bool) else [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    # ✅ Basic throttling to protect the free-tier server from overload
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "300/min",
    },
}

# ──────────────────────────────────────────────
# STATIC FILES
# ──────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# ──────────────────────────────────────────────
# EMAIL SETTINGS
# ──────────────────────────────────────────────
EMAIL_BACKEND = 'sendgrid_backend.SendgridBackend'
SENDGRID_API_KEY = config('SENDGRID_API_KEY')
SENDGRID_SANDBOX_MODE_IN_DEBUG = False
DEFAULT_FROM_EMAIL = config("EMAIL_HOST_USER")

# ──────────────────────────────────────────────
# SMS SETTINGS
# ──────────────────────────────────────────────
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '')

# ──────────────────────────────────────────────
# PASSWORD VALIDATION
# ──────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ──────────────────────────────────────────────
# INTERNATIONALIZATION
# ──────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Manila"
USE_I18N = True
USE_TZ = True

# ──────────────────────────────────────────────
# MISC
# ──────────────────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
APPEND_SLASH = False

# ──────────────────────────────────────────────
# TEMPLATES
# ──────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
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