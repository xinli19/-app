from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, StudentTagViewSet

router = DefaultRouter()
router.register(r'', StudentViewSet, basename='student')
router.register(r'tags', StudentTagViewSet, basename='student-tag')

urlpatterns = router.urls