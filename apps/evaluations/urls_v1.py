from rest_framework.routers import DefaultRouter
from .views import FeedbackRecordViewSet, OpsFeedbackExportView, ResearchFeedbackExportView, WorkloadsView, EvaluationTaskViewSet
from django.urls import path
from .views import EvaluationTaskBatchListView, EvaluationTaskBatchDetailView

router = DefaultRouter()
router.register(r'feedbacks', FeedbackRecordViewSet, basename='feedback')
router.register(r'tasks', EvaluationTaskViewSet, basename='task')
router.register(r'eval-tasks', EvaluationTaskViewSet, basename='eval-task')

urlpatterns = router.urls + [
    path('ops/feedbacks/export', OpsFeedbackExportView.as_view(), name='ops-feedbacks-export'),
    path('feedbacks/export', ResearchFeedbackExportView.as_view(), name='research-feedbacks-export'),
    path('workloads', WorkloadsView.as_view(), name='research-workloads'),
    path('eval-task-batches/', EvaluationTaskBatchListView.as_view(), name='eval-task-batches'),
    path('eval-task-batches/<uuid:batch_id>/', EvaluationTaskBatchDetailView.as_view(), name='eval-task-batch-detail'),
]