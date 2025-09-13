from rest_framework import viewsets
from .models import Person
from .serializers import PersonSerializer
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.all().order_by('-created_at')
    serializer_class = PersonSerializer

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    role = request.data.get('role')
    
    # 使用Django内置认证
    user = authenticate(username=username, password=password)
    
    if user:
        # 获取或创建token
        token, created = Token.objects.get_or_create(user=user)
        
        # 映射或创建 Person（根据 email 优先，其次 username）
        from .models import Person
        person = None
        user_email = getattr(user, 'email', None) or None
        if user_email:
            person = Person.objects.filter(email=user_email).first()
        if not person:
            person = Person.objects.filter(name=user.username).first()
        if not person:
            person = Person.objects.create(name=user.username, email=user_email)

        # 新增：若未绑定，则把该 Person 绑定到当前登录账号
        if not getattr(person, 'user_id', None):
            person.user = user
            person.save(update_fields=['user'])

        return Response({
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'person_id': str(person.id),
                'role': role  # 或从Person模型获取实际角色
            }
        })
    else:
        return Response(
            {'error': '用户名或密码错误'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
        
from .models import PersonRole
from .serializers import PersonRoleSerializer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.pagination import PageNumberPagination  # 新增：分页

class LargeResultsSetPagination(PageNumberPagination):  # 新增：支持 size 参数
    page_size = 100
    page_size_query_param = 'size'
    max_page_size = 1000

class PersonRoleViewSet(viewsets.ModelViewSet):
    queryset = PersonRole.objects.select_related('person').all().order_by('-created_at')
    serializer_class = PersonRoleSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['role', 'person']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    pagination_class = LargeResultsSetPagination  # 新增：启用支持 size 的分页