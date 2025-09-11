from rest_framework.routers import DefaultRouter
from .views import FollowUpRecordViewSet

router = DefaultRouter()
router.register(r'visit-records', FollowUpRecordViewSet, basename='visit-records')

urlpatterns = router.urls