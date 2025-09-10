from rest_framework import serializers
from .models import Person

class PersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = [
            'id',
            'name',
            'status',
            'email',
            'phone',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

from .models import PersonRole

class PersonRoleSerializer(serializers.ModelSerializer):
    person_name = serializers.ReadOnlyField(source='person.name')

    class Meta:
        model = PersonRole
        fields = ['id', 'person', 'person_name', 'role', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
