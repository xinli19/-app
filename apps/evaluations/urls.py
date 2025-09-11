from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EvaluationTaskViewSet, FeedbackRecordViewSet, FeedbackPieceDetailViewSet

router = DefaultRouter()
router.register(r'evaluation-tasks', EvaluationTaskViewSet, basename='evaluation-task')
router.register(r'feedback-records', FeedbackRecordViewSet, basename='feedback-record')
router.register(r'feedback-piece-details', FeedbackPieceDetailViewSet, basename='feedback-piece-detail')

urlpatterns = [
    path('', include(router.urls)),
]