from rest_framework.routers import DefaultRouter
from .views import PersonRoleViewSet

router = DefaultRouter()
router.register(r'', PersonRoleViewSet, basename='person-role')

urlpatterns = router.urls