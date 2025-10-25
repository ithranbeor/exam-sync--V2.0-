from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import TblUsers, TblUserRole, TblExamdetails, TblModality, TblAvailability, TblCourseUsers, TblSectioncourse, TblUserRoleHistory, TblRoles, TblBuildings, TblRooms, TblCourse, TblExamperiod, TblProgram, TblInbox, TblTerm, TblCollege, TblDepartment
from .serializers import (
    UserSerializer,
    UserRoleSerializer,
    TblExamperiodSerializer,
    TblUserRoleSerializer,
    TblInboxSerializer,
    TblTermSerializer,
    TblCollegeSerializer,
    TblDepartmentSerializer,
    TblProgramSerializer,
    CourseSerializer,
    TblRoomsSerializer,
    TblBuildingsSerializer,
    TblUsersSerializer,
    TblRolesSerializer,
    TblUserRoleHistorySerializer,
    TblSectioncourseSerializer,
    TblCourseUsersSerializer,
    TblAvailabilitySerializer,
    TblModalitySerializer,
    TblExamdetailsSerializer
)
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction
from django.utils import timezone

import secrets
from django.core.cache import cache

User = get_user_model()

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_examdetails_list(request):
    if request.method == 'GET':
        queryset = TblExamdetails.objects.all()

        # Optional filtering (e.g., ?room_id=R101&date=2025-10-23)
        room_id = request.GET.get('room_id')
        exam_date = request.GET.get('exam_date')

        if room_id:
            queryset = queryset.filter(room__room_id=room_id)
        if exam_date:
            queryset = queryset.filter(exam_date=exam_date)

        serializer = TblExamdetailsSerializer(queryset, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblExamdetailsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_examdetails_detail(request, pk):
    try:
        instance = TblExamdetails.objects.get(pk=pk)
    except TblExamdetails.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblExamdetailsSerializer(instance)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblExamdetailsSerializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_modality_list(request):
    if request.method == 'GET':
        queryset = TblModality.objects.all()

        # Optional filtering by query params
        course_id = request.GET.get('course_id')
        program_id = request.GET.get('program_id')
        section_name = request.GET.get('section_name')
        modality_type = request.GET.get('modality_type')
        room_type = request.GET.get('room_type')

        if course_id:
            queryset = queryset.filter(course=course_id)
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        if section_name:
            queryset = queryset.filter(section_name=section_name)
        if modality_type:
            queryset = queryset.filter(modality_type=modality_type)
        if room_type:
            queryset = queryset.filter(room_type=room_type)

        serializer = TblModalitySerializer(queryset, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblModalitySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_modality_detail(request, pk):
    try:
        instance = TblModality.objects.get(pk=pk)
    except TblModality.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblModalitySerializer(instance)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblModalitySerializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_availability_list(request):
    if request.method == 'GET':
        user_id = request.GET.get('user_id')
        college_id = request.GET.get('college_id')
        
        availabilities = TblAvailability.objects.all()
        
        if user_id:
            availabilities = availabilities.filter(user__user_id=user_id)
        
        if college_id:
            availabilities = availabilities.filter(user__college_id=college_id)
        
        serializer = TblAvailabilitySerializer(availabilities, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data

        # ✅ Detect if multiple records are being sent
        if isinstance(data, list):
            serializer = TblAvailabilitySerializer(data=data, many=True)
        else:
            serializer = TblAvailabilitySerializer(data=data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_availability_detail(request, availability_id):
    try:
        availability = TblAvailability.objects.get(pk=availability_id)
    except TblAvailability.DoesNotExist:
        return Response({'error': 'Availability not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblAvailabilitySerializer(availability)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblAvailabilitySerializer(availability, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        availability.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_course_users_list(request):
    if request.method == 'GET':
        course_users = TblCourseUsers.objects.select_related('course', 'user').all()
        serializer = TblCourseUsersSerializer(course_users, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblCourseUsersSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_course_users_detail(request, course_id, user_id):
    try:
        course_user = TblCourseUsers.objects.get(course__course_id=course_id, user__user_id=user_id)
    except TblCourseUsers.DoesNotExist:
        return Response({'error': 'Record not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblCourseUsersSerializer(course_user)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblCourseUsersSerializer(course_user, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        course_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_sectioncourse_list(request):
    if request.method == 'GET':
        sections = TblSectioncourse.objects.all()
        serializer = TblSectioncourseSerializer(sections, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblSectioncourseSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_sectioncourse_detail(request, pk):
    try:
        section = TblSectioncourse.objects.get(pk=pk)
    except TblSectioncourse.DoesNotExist:
        return Response({'error': 'Section not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblSectioncourseSerializer(section)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblSectioncourseSerializer(section, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        section.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_roles_list(request):
    if request.method == 'GET':
        roles = TblRoles.objects.all()
        serializer = TblRolesSerializer(roles, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblRolesSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_roles_detail(request, role_id):
    try:
        role = TblRoles.objects.get(pk=role_id)
    except TblRoles.DoesNotExist:
        return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblRolesSerializer(role)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblRolesSerializer(role, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET'])
@permission_classes([AllowAny])
def user_role_history_list(request):
    """
    List all history records or filter by user_role_id.
    """
    user_role_id = request.GET.get('user_role_id')
    queryset = TblUserRoleHistory.objects.all().order_by('-changed_at')
    if user_role_id:
        queryset = queryset.filter(user_role_id=user_role_id)
    
    serializer = TblUserRoleHistorySerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def user_role_history_create(request):
    """
    Append a new history record. No updates allowed.
    """
    data = request.data.copy()
    data['changed_at'] = timezone.now()  # Automatically set timestamp
    
    serializer = TblUserRoleHistorySerializer(data=data)
    if serializer.is_valid():
        # Directly create in DB
        TblUserRoleHistory.objects.create(**serializer.validated_data)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def accounts_list(request):
    if request.method == 'GET':
        users = TblUsers.objects.all().order_by('-created_at')
        serializer = TblUsersSerializer(users, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblUsersSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def accounts_detail(request, pk):
    try:
        user = TblUsers.objects.get(user_id=pk)
    except TblUsers.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblUsersSerializer(user)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblUsersSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        user.delete()
        return Response({'message': 'Deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_buildings_list(request):
    if request.method == 'GET':
        buildings = TblBuildings.objects.all()
        serializer = TblBuildingsSerializer(buildings, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblBuildingsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_buildings_detail(request, pk):
    try:
        building = TblBuildings.objects.get(pk=pk)
    except TblBuildings.DoesNotExist:
        return Response({'error': 'Building not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblBuildingsSerializer(building)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblBuildingsSerializer(building, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        building.delete()
        return Response({'message': 'Building deleted'}, status=status.HTTP_204_NO_CONTENT)


# 🚪 ROOMS
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_rooms_list(request):
    if request.method == 'GET':
        rooms = TblRooms.objects.all()
        serializer = TblRoomsSerializer(rooms, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblRoomsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_rooms_detail(request, pk):
    try:
        room = TblRooms.objects.get(pk=pk)
    except TblRooms.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblRoomsSerializer(room)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblRoomsSerializer(room, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        room.delete()
        return Response({'message': 'Room deleted'}, status=status.HTTP_204_NO_CONTENT)

# COURSES
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def courses_list(request):
    if request.method == 'GET':
        # ✅ Properly serialize queryset
        courses = TblCourse.objects.all()
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = CourseSerializer(data=request.data)
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    course = serializer.create(serializer.validated_data)
                    # ✅ Use serializer’s to_representation for response
                    return Response(CourseSerializer().to_representation(course), status=status.HTTP_201_CREATED)
            except TblTerm.DoesNotExist:
                return Response({'error': 'Term not found'}, status=status.HTTP_400_BAD_REQUEST)
            except TblUsers.DoesNotExist:
                return Response({'error': 'One or more users not found'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def course_detail(request, pk):
    try:
        course = TblCourse.objects.get(pk=pk)
    except TblCourse.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(CourseSerializer().to_representation(course))

    if request.method in ('PUT', 'PATCH'):
        serializer = CourseSerializer(data=request.data)
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    course = serializer.update(course, serializer.validated_data)
                    return Response(CourseSerializer().to_representation(course))
            except TblTerm.DoesNotExist:
                return Response({'error': 'Term not found'}, status=status.HTTP_400_BAD_REQUEST)
            except TblUsers.DoesNotExist:
                return Response({'error': 'One or more users not found'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        # delete course and related course-user mappings
        from .models import TblCourseUsers
        TblCourseUsers.objects.filter(course=course).delete()
        course.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def program_list(request):
    if request.method == 'GET':
        programs = TblProgram.objects.all()
        serializer = TblProgramSerializer(programs, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblProgramSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def program_detail(request, pk):
    try:
        program = TblProgram.objects.get(pk=pk)
    except TblProgram.DoesNotExist:
        return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblProgramSerializer(program)
        return Response(serializer.data)

    elif request.method == 'PATCH':
        serializer = TblProgramSerializer(program, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        program.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def department_list(request):
    if request.method == 'GET':
        departments = TblDepartment.objects.all()
        serializer = TblDepartmentSerializer(departments, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblDepartmentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def department_detail(request, pk):
    try:
        department = TblDepartment.objects.get(pk=pk)
    except TblDepartment.DoesNotExist:
        return Response({'error': 'Department not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblDepartmentSerializer(department)
        return Response(serializer.data)

    elif request.method == 'PATCH':
        serializer = TblDepartmentSerializer(department, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        department.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_college_list(request):
    if request.method == 'GET':
        colleges = TblCollege.objects.all()
        serializer = TblCollegeSerializer(colleges, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = TblCollegeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_college_detail(request, pk):
    try:
        college = TblCollege.objects.get(pk=pk)
    except TblCollege.DoesNotExist:
        return Response({'error': 'College not found'}, status=404)

    if request.method == 'GET':
        serializer = TblCollegeSerializer(college)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblCollegeSerializer(college, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    elif request.method == 'DELETE':
        college.delete()
        return Response(status=204)
    
# ------------------------------
# PASSWORD RESET - STEP 1: Send reset email
# ------------------------------
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_change(request):
    email = request.data.get('email')

    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = TblUsers.objects.get(email_address=email)
    except TblUsers.DoesNotExist:
        return Response({'error': 'No account found with this email.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        # Generate a secure random token
        token = secrets.token_urlsafe(32)
        uid = str(user.pk)

        # Save token in cache for 15 minutes
        cache_key = f"password_reset_{uid}"
        cache.set(cache_key, token, timeout=15 * 60)

        # Build frontend reset URL
        reset_link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

        subject = "Password Reset Request"
        message = (
            f"Hi {user.first_name},\n\n"
            f"You recently requested to reset your password.\n\n"
            f"Click the link below to set a new one:\n\n{reset_link}\n\n"
            f"This link will expire in 15 minutes.\n\n"
            f"Best,\nExamSync Team"
        )

        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email])

        return Response({'message': 'Password reset link sent successfully!'}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': f'Failed to send email: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ------------------------------
# PASSWORD RESET - STEP 2: Confirm new password
# ------------------------------
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def confirm_password_change(request):
    uid = request.data.get("uid")
    token = request.data.get("token")
    new_password = request.data.get("new_password")

    if not all([uid, token, new_password]):
        return Response({"error": "Missing fields"}, status=400)

    try:
        user = TblUsers.objects.get(pk=uid)
    except TblUsers.DoesNotExist:
        return Response({"error": "Invalid user"}, status=404)

    cache_key = f"password_reset_{uid}"
    stored_token = cache.get(cache_key)

    if not stored_token or stored_token != token:
        return Response({"error": "Invalid or expired link."}, status=400)

    # ✅ Hash and save new password properly
    user.password = make_password(new_password)
    user.save()

    # ✅ Clear the used token
    cache.delete(cache_key)

    print(f"✅ Password successfully changed for user {user.user_id}")
    return Response({"message": "Password changed successfully!"}, status=200)

# ------------------------------
# Mock login (no password check for now)
# ------------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def login_faculty(request):
    email = request.data.get('email')
    password = request.data.get('password')  # currently unused

    if not email:
        return Response({'message': 'Email required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = TblUsers.objects.get(email_address=email)

        # Simulate successful login since we have no password yet
        mock_token = f"mock-token-for-{user.user_id}"
        return Response({'token': mock_token, 'user_id': user.user_id})

    except TblUsers.DoesNotExist:
        return Response({'message': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

# ------------------------------
# List all users
# ------------------------------
@api_view(['GET'])
@permission_classes([AllowAny])
def users_list(request):
    users = TblUsers.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

# ------------------------------
# Single user detail
# ------------------------------
@csrf_exempt
@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([AllowAny])
def user_detail(request, user_id):
    try:
        user = TblUsers.objects.get(user_id=user_id)
    except TblUsers.DoesNotExist:
        return Response({'message': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = UserSerializer(user)
        return Response(serializer.data)

    elif request.method in ['PUT', 'PATCH']:
        serializer = UserSerializer(
            user, data=request.data, partial=(request.method == 'PATCH')
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ------------------------------
# User roles
# ------------------------------
@api_view(['GET'])
@permission_classes([AllowAny])
def user_roles(request, user_id):
    roles = TblUserRole.objects.filter(user__user_id=user_id)
    serializer = UserRoleSerializer(roles, many=True)
    return Response(serializer.data)


# ------------------------------
# Exam periods
# ------------------------------
@api_view(['PUT'])
@permission_classes([AllowAny])
def tbl_examperiod_bulk_update(request):
    updates = request.data.get('updates', [])
    if not updates:
        return Response({"error": "updates required"}, status=400)

    updated_count = 0
    for item in updates:
        start_date = item.get('start_date')
        college_identifier = item.get('college_name')  # This is actually college_id from frontend
        college_to_remove = item.get('college_to_remove')
        
        if not start_date:
            continue
        
        # Convert string date to datetime with timezone
        from django.utils import timezone
        from datetime import datetime
        
        try:
            date_obj = datetime.strptime(start_date, '%Y-%m-%d')
            date_obj = timezone.make_aware(date_obj)
        except ValueError:
            continue
        
        if college_to_remove:
            # Remove specific college by college_id or college_name
            deleted = TblExamperiod.objects.filter(
                start_date=date_obj,
                college__college_id=college_to_remove
            ).delete()
            
            if deleted[0] == 0:
                # Try by college_name if college_id didn't work
                deleted = TblExamperiod.objects.filter(
                    start_date=date_obj,
                    college__college_name=college_to_remove
                ).delete()
            
            updated_count += deleted[0]
            
        elif college_identifier:
            # Add college - first try to find the college by college_id
            try:
                college_obj = TblCollege.objects.get(college_id=college_identifier)
            except TblCollege.DoesNotExist:
                # Try by college_name as fallback
                try:
                    college_obj = TblCollege.objects.get(college_name=college_identifier)
                except TblCollege.DoesNotExist:
                    print(f"College not found: {college_identifier}")
                    continue
            
            # Check if this college already has an exam period on this date
            existing = TblExamperiod.objects.filter(
                start_date=date_obj,
                college=college_obj
            ).first()
            
            if not existing:
                # Find a template exam period on this date to copy metadata from
                template = TblExamperiod.objects.filter(start_date=date_obj).first()
                
                if template:
                    # Create new exam period for this college
                    TblExamperiod.objects.create(
                        start_date=template.start_date,
                        end_date=template.end_date,
                        academic_year=template.academic_year,
                        exam_category=template.exam_category,
                        term=template.term,
                        department=template.department,
                        college=college_obj
                    )
                    updated_count += 1
                else:
                    print(f"No template exam period found for date: {start_date}")

    return Response({"updated_count": updated_count})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_examperiod_list(request):
    if request.method == 'GET':
        periods = TblExamperiod.objects.all().order_by('-examperiod_id')
        serializer = TblExamperiodSerializer(periods, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblExamperiodSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_examperiod_detail(request, pk):
    try:
        period = TblExamperiod.objects.get(pk=pk)
    except TblExamperiod.DoesNotExist:
        return Response({'error': 'Exam period not found'}, status=404)

    if request.method == 'GET':
        serializer = TblExamperiodSerializer(period)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblExamperiodSerializer(period, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    elif request.method == 'DELETE':
        period.delete()
        return Response(status=204)

# ------------------------------
# User role list
# ------------------------------
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_user_role_list(request):
    if request.method == 'GET':
        user_id = request.GET.get('user_id')
        role_id = request.GET.get('role_id')
        queryset = TblUserRole.objects.select_related('role', 'college', 'department').all()
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if role_id:
            queryset = queryset.filter(role_id=role_id)
        serializer = TblUserRoleSerializer(queryset, many=True)
        return Response(serializer.data)
        

    elif request.method == 'POST':
        print(request.data)
        serializer = TblUserRoleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_user_role_detail(request, user_role_id):
    try:
        instance = TblUserRole.objects.get(pk=user_role_id)
    except TblUserRole.DoesNotExist:
        return Response({'error': 'User role not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblUserRoleSerializer(instance)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblUserRoleSerializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
# ------------------------------
# Inbox list
# ------------------------------
@csrf_exempt
@api_view(['GET'])
@permission_classes([AllowAny])
def inbox_list(request):
    """Return inbox messages for a receiver."""
    receiver_id = request.GET.get('receiver_id')
    is_read = request.GET.get('is_read')
    is_deleted = request.GET.get('is_deleted')

    queryset = TblInbox.objects.all()
    if receiver_id:
        queryset = queryset.filter(receiver_id=receiver_id)
    if is_read is not None:
        queryset = queryset.filter(is_read=is_read.lower() == 'true')
    if is_deleted is not None:
        queryset = queryset.filter(is_deleted=is_deleted.lower() == 'true')

    serializer = TblInboxSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_term_list(request):
    if request.method == 'GET':
        terms = TblTerm.objects.all().order_by('term_id')
        serializer = TblTermSerializer(terms, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        term_name = request.data.get('term_name', '').strip()

        # ✅ prevent ENUM DB crash
        if not term_name:
            return Response(
                {"term_name": ["Term name cannot be empty."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = TblTermSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_term_detail(request, pk):
    try:
        term = TblTerm.objects.get(pk=pk)
    except TblTerm.DoesNotExist:
        return Response({'error': 'Term not found'}, status=404)

    if request.method == 'PUT':
        serializer = TblTermSerializer(term, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    elif request.method == 'DELETE':
        term.delete()
        return Response(status=204)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_user(request, user_id):
    try:
        user = TblUsers.objects.get(user_id=user_id)
        serializer = UserSerializer(user)  # Use your existing serializer
        return Response(serializer.data)
    except TblUsers.DoesNotExist:
        return Response({"error": "User not found"}, status=404)
