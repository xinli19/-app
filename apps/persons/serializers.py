from rest_framework import serializers
from .models import Person, PersonRole

class PersonSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Person
        fields = ("id", "name", "username", "status", "email", "phone", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")

class PersonRoleSerializer(serializers.ModelSerializer):
    person_name = serializers.ReadOnlyField(source='person.name')

    class Meta:
        model = PersonRole
        fields = ['id', 'person', 'person_name', 'role', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
