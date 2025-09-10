from rest_framework import viewsets
from .models import Person
from .serializers import PersonSerializer

class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.all().order_by('-created_at')
    serializer_class = PersonSerializer

from .models import PersonRole
from .serializers import PersonRoleSerializer
from django_filters.rest_framework import DjangoFilterBackend

class PersonRoleViewSet(viewsets.ModelViewSet):
    queryset = PersonRole.objects.select_related('person').all().order_by('-created_at')
    serializer_class = PersonRoleSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['role', 'person']
    ordering_fields = ['created_at']
    ordering = ['-created_at']