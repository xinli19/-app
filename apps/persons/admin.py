from django.contrib import admin
from .models import Person
from .models import PersonRole
from apps.core.enums import RoleType

class PersonRoleInline(admin.TabularInline):
    model = PersonRole
    extra = 1
    fk_name = 'person'
    fields = ('role',)
    verbose_name = '角色'
    verbose_name_plural = '角色'

class PersonRoleRoleFilter(admin.SimpleListFilter):
    title = '角色'
    parameter_name = 'role'

    def lookups(self, request, model_admin):
        return [
            (RoleType.TEACHER, '教师'),
            (RoleType.RESEARCHER, '教研'),
            (RoleType.OPERATOR, '运营'),
        ]

    def queryset(self, request, queryset):
        value = self.value()
        if value:
            return queryset.filter(roles__role=value).distinct()
        return queryset

@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'status', 'roles_display', 'email', 'phone', 'created_at', 'updated_at')
    search_fields = ('name', 'email', 'phone')
    list_filter = ('status', PersonRoleRoleFilter)
    ordering = ('-created_at',)
    inlines = [PersonRoleInline]

    def roles_display(self, obj):
        return '、'.join(r.get_role_display() for r in obj.roles.all())
    roles_display.short_description = '角色'

@admin.register(PersonRole)
class PersonRoleAdmin(admin.ModelAdmin):
    list_display = ('id', 'person', 'role', 'created_at', 'updated_at')
    list_filter = ('role',)
    search_fields = ('person__name',)
    ordering = ('-created_at',)