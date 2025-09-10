from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, StudentTagViewSet
from .views import CourseRecordViewSet

router = DefaultRouter()
router.register(r'', StudentViewSet, basename='student')
router.register(r'tags', StudentTagViewSet, basename='student-tag')
router.register(r'course-records', CourseRecordViewSet, basename='course-record')

urlpatterns = router.urls