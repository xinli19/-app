from django.urls import path
from .views import ImportPreviewView, ImportCommitView, ImportBatchDetailView, OpsStudentsExportView
from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, StudentTagViewSet, CourseRecordViewSet

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')
router.register(r'student-tags', StudentTagViewSet, basename='student-tag')
router.register(r'course-records', CourseRecordViewSet, basename='course-record')

urlpatterns = router.urls + [
    path('students/import/preview', ImportPreviewView.as_view(), name='students-import-preview'),
    path('students/import/commit', ImportCommitView.as_view(), name='students-import-commit'),
    path('students/import/batches/<uuid:batch_id>', ImportBatchDetailView.as_view(), name='students-import-batch-detail'),
    path('ops/students/export', OpsStudentsExportView.as_view(), name='ops-students-export'),
]