"""
URL configuration for course_system project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponseRedirect, HttpResponse, Http404
from django.views.generic import RedirectView
from django.shortcuts import render
import os
import mimetypes

def serve_frontend_file(request, filename):
    """Serve frontend static files"""
    frontend_dir = os.path.join(settings.BASE_DIR, 'frontend')
    file_path = os.path.join(frontend_dir, filename)
    
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        raise Http404("File not found")
    
    # Security check: ensure the file is within the frontend directory
    if not os.path.abspath(file_path).startswith(os.path.abspath(frontend_dir)):
        raise Http404("Access denied")
    
    content_type, _ = mimetypes.guess_type(file_path)
    if content_type is None:
        content_type = 'application/octet-stream'
    
    with open(file_path, 'rb') as f:
        response = HttpResponse(f.read(), content_type=content_type)
        return response

urlpatterns = [
    path('', RedirectView.as_view(url='/frontend/index.html', permanent=False)),
    path('admin/', admin.site.urls),
    path('auth/', include('apps.persons.auth_urls')),
    path('api/persons/roles/', include('apps.persons.role_urls')),  # 放到更前面，避免被 /api/persons/ 吞掉
    path('api/persons/', include('apps.persons.urls')),
    path('api/evaluations/', include('apps.evaluations.urls')),
    path('api/courses/', include('apps.courses.urls')),
    path('api/students/', include('apps.students.urls')),
    path('api/announcements/', include('apps.announcements.urls')),
    path('api/followups/', include('apps.followups.urls_v1')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/v1/', include('apps.reminders.urls')),
    path('api/v1/', include('apps.evaluations.urls_v1')),
    path('api/v1/', include('apps.students.urls_v1')),
    path('api/v1/', include('apps.followups.urls_v1')),
    path('api/v1/', include('apps.students.urls_v1')),
    path('api/v1/', include('apps.announcements.urls_v1')),
    path('frontend/<path:filename>', lambda request, filename: serve_frontend_file(request, filename)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)