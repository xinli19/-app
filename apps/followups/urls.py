from rest_framework.routers import DefaultRouter
from .views import FollowUpRecordViewSet

router = DefaultRouter()
router.register(r'followups', FollowUpRecordViewSet, basename='followup-record')

urlpatterns = router.urls