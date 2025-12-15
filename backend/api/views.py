# exam-sync-v2/backend/api/views.py

from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework import status
from django.views.decorators.cache import cache_page
from django.db.models import Q
from .models import TblUsers, TblScheduleapproval, TblScheduleFooter, TblProctorSubstitution, TblProctorAttendance, TblExamOtp, TblAvailableRooms, TblNotification, TblUserRole, TblExamdetails, TblModality, TblAvailability, TblCourseUsers, TblSectioncourse, TblUserRoleHistory, TblRoles, TblBuildings, TblRooms, TblCourse, TblExamperiod, TblProgram, TblTerm, TblCollege, TblDepartment
from .serializers import (
    UserSerializer,
    UserRoleSerializer,
    TblExamperiodSerializer,
    TblUserRoleSerializer,
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
    TblExamdetailsSerializer,
    TblScheduleapprovalSerializer,
    ScheduleSendSerializer,
    TblNotificationSerializer,
    EmailNotificationSerializer,
    TblAvailableRoomsSerializer,
    TblScheduleFooterSerializer
)
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from uuid import uuid4
from threading import Thread
from django.db.models import Q, Prefetch
import random
import string
from datetime import datetime, timedelta
import secrets
from django.core.cache import cache
import re

User = get_user_model()

@api_view(['GET'])
@permission_classes([AllowAny])
def get_current_user(request):
    """
    Get current user information from token or user_id
    """
    try:
        # Try to get user_id from query params
        user_id = request.GET.get('user_id')
        
        if not user_id:
            return Response({
                'error': 'user_id parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = TblUsers.objects.get(user_id=user_id)
        
        # Return user data with full_name
        return Response({
            'data': {
                'user_id': user.user_id,
                'first_name': user.first_name,
                'middle_name': user.middle_name,
                'last_name': user.last_name,
                'full_name': f"{user.first_name} {user.middle_name or ''} {user.last_name}".strip(),
                'email_address': user.email_address,
                'contact_number': user.contact_number,
                'status': user.status,
                'avatar_url': user.avatar_url,
            }
        }, status=status.HTTP_200_OK)
        
    except TblUsers.DoesNotExist:
        return Response({
            'error': 'User not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"❌ Error fetching current user: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e),
            'detail': 'Failed to fetch user'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ============================================================
# OTP GENERATION
# ============================================================

def generate_otp_code(exam_schedule):
    import random
    import string
    
    otp_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    return otp_code

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_exam_otps(request):
    try:
        schedule_ids = request.data.get('schedule_ids', [])
        
        if schedule_ids:
            schedules = TblExamdetails.objects.filter(
                examdetails_id__in=schedule_ids
            ).select_related('room', 'room__building', 'proctor', 'modality')
        else:
            existing_otp_schedule_ids = TblExamOtp.objects.values_list('examdetails_id', flat=True)
            schedules = TblExamdetails.objects.exclude(
                examdetails_id__in=existing_otp_schedule_ids
            ).select_related('room', 'room__building', 'proctor', 'modality')
        
        if not schedules.exists():
            return Response({
                'message': 'No schedules found or all schedules already have OTP codes',
                'generated_count': 0
            }, status=status.HTTP_200_OK)
        
        otp_records = []
        generated_count = 0
        
        with transaction.atomic():
            for schedule in schedules:
                if TblExamOtp.objects.filter(examdetails=schedule).exists():
                    continue
                
                otp_code = generate_otp_code(schedule)
                
                while TblExamOtp.objects.filter(otp_code=otp_code).exists():
                    otp_code = generate_otp_code(schedule)
                
                if schedule.exam_end_time:
                    if isinstance(schedule.exam_end_time, datetime):
                        expires_at = schedule.exam_end_time
                    else:
                        from datetime import datetime as dt
                        if schedule.exam_date:
                            try:
                                exam_date_obj = dt.strptime(schedule.exam_date, '%Y-%m-%d').date()
                                expires_at = timezone.make_aware(
                                    dt.combine(exam_date_obj, schedule.exam_end_time)
                                )
                            except Exception as e:
                                expires_at = timezone.now() + timedelta(hours=3)
                        else:
                            expires_at = timezone.now() + timedelta(hours=3)
                else:
                    expires_at = timezone.now() + timedelta(hours=3)
                
                otp_record = TblExamOtp.objects.create(
                    examdetails=schedule,
                    otp_code=otp_code,
                    expires_at=expires_at
                )
                
                otp_records.append({
                    'schedule_id': schedule.examdetails_id,
                    'course_id': schedule.course_id,
                    'section_name': schedule.section_name,
                    'otp_code': otp_code,
                    'exam_date': schedule.exam_date,
                    'exam_start_time': str(schedule.exam_start_time),
                    'expires_at': expires_at.isoformat()
                })
                
                generated_count += 1
        
        return Response({
            'message': f'Successfully generated {generated_count} OTP codes',
            'generated_count': generated_count,
            'otp_records': otp_records[:10]  # Return first 10 for preview
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e),
            'detail': 'Failed to generate OTP codes'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
@api_view(['POST'])
@permission_classes([AllowAny])
def reset_exam_otps(request):
    """
    Reset (delete) OTP codes for specified exam schedules
    """
    try:
        schedule_ids = request.data.get('schedule_ids', [])
        
        with transaction.atomic():
            if schedule_ids and len(schedule_ids) > 0:
                # Delete OTP codes for specific schedules
                deleted_count = TblExamOtp.objects.filter(
                    examdetails_id__in=schedule_ids
                ).delete()[0]
            else:
                # Delete all OTP codes if no schedule_ids provided
                deleted_count = TblExamOtp.objects.all().delete()[0]
                
        return Response({
            'success': True,
            'deleted_count': deleted_count,
            'message': f'Successfully reset {deleted_count} OTP code(s)'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



# ============================================================
# OTP VERIFICATION
# ============================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    """
    Verify OTP code and check if user is assigned proctor
    """
    try:
        otp_code = request.data.get('otp_code', '').strip()
        user_id = request.data.get('user_id')
                
        if not otp_code or not user_id:
            return Response({
                'valid': False,
                'message': 'OTP code and user_id are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find OTP record
        try:
            otp_record = TblExamOtp.objects.select_related(
                'examdetails',
                'examdetails__room',
                'examdetails__proctor',
                'examdetails__modality'
            ).get(otp_code=otp_code)
        except TblExamOtp.DoesNotExist:
            return Response({
                'valid': False,
                'message': 'Invalid OTP code'
            }, status=status.HTTP_200_OK)
        
        # Check if expired
        now = timezone.now()
        
        if now > otp_record.expires_at:
            print(f"❌ OTP expired")
            return Response({
                'valid': False,
                'message': 'OTP code has expired'
            }, status=status.HTTP_200_OK)
        
        exam_schedule = otp_record.examdetails
  
        if exam_schedule.exam_start_time and exam_schedule.exam_end_time:
            from datetime import datetime as dt
            
            # Parse exam date
            if exam_schedule.exam_date:
                try:
                    exam_date_obj = dt.strptime(exam_schedule.exam_date, '%Y-%m-%d').date()
                    
                    # Combine date with start and end times
                    exam_start_datetime = timezone.make_aware(
                        dt.combine(exam_date_obj, exam_schedule.exam_start_time)
                    )
                    exam_end_datetime = timezone.make_aware(
                        dt.combine(exam_date_obj, exam_schedule.exam_end_time)
                    )
                    
                    # Allow entry 30 minutes before start
                    early_entry_window = exam_start_datetime - timedelta(minutes=30)
                    
                    if now < early_entry_window:
                        return Response({
                            'valid': False,
                            'message': 'Too early to verify. You can verify 30 minutes before the exam starts.'
                        }, status=status.HTTP_200_OK)
                    
                    if now > exam_end_datetime:
                        return Response({
                            'valid': False,
                            'message': 'Exam has already ended. Attendance recording is closed.'
                        }, status=status.HTTP_200_OK)
                    
                except Exception as e:
                    print(f"⚠️ Error parsing exam times: {str(e)}")
                    # Continue anyway
        
        # Check if user is the assigned proctor
        is_assigned = False
        assigned_proctor_name = None
        
        print(f"👤 Checking if user {user_id} is assigned proctor")
        print(f"👤 Schedule proctor_id: {exam_schedule.proctor_id}")
        print(f"👤 Schedule proctors array: {exam_schedule.proctors}")
        
        # Check both single proctor_id and proctors array
        if exam_schedule.proctor_id == user_id:
            is_assigned = True
            print(f"✅ User is assigned proctor (proctor_id match)")
        elif exam_schedule.proctors and user_id in exam_schedule.proctors:
            is_assigned = True
            print(f"✅ User is assigned proctor (in proctors array)")
        else:
            print(f"⚠️ User is NOT assigned proctor")
        
        # Get assigned proctor name
        if exam_schedule.proctor:
            assigned_proctor_name = f"{exam_schedule.proctor.first_name} {exam_schedule.proctor.last_name}"
        
        verification_status = "valid-assigned" if is_assigned else "valid-not-assigned"
        message = "OTP verified. You are assigned to this exam." if is_assigned else "OTP is valid, but you are not the assigned proctor. Do you want to substitute?"
        
        # Get sections display
        sections_display = ', '.join(exam_schedule.sections) if exam_schedule.sections else exam_schedule.section_name
        
        print(f"✅ OTP verification successful: {verification_status}")
        
        return Response({
            'valid': True,
            'verification_status': verification_status,
            'message': message,
            'exam_schedule_id': exam_schedule.examdetails_id,
            'course_id': exam_schedule.course_id,
            'section_name': sections_display,
            'exam_date': exam_schedule.exam_date,
            'exam_start_time': exam_schedule.exam_start_time.isoformat() if exam_schedule.exam_start_time else None,
            'exam_end_time': exam_schedule.exam_end_time.isoformat() if exam_schedule.exam_end_time else None,
            'building_name': exam_schedule.building_name,
            'room_id': exam_schedule.room.room_id if exam_schedule.room else None,
            'assigned_proctor_id': exam_schedule.proctor_id,
            'assigned_proctor_name': assigned_proctor_name
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"❌ Error verifying OTP: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'valid': False,
            'error': str(e),
            'detail': 'Failed to verify OTP'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# ATTENDANCE SUBMISSION
# ============================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def submit_proctor_attendance(request):
    try:
        otp_code = request.data.get('otp_code', '').strip()
        user_id = request.data.get('user_id')
        remarks = request.data.get('remarks', '').strip()
        role = request.data.get('role', 'assigned')
        
        print(f"\n{'='*60}")
        print(f"📥 SUBMITTING ATTENDANCE")
        print(f"{'='*60}")
        print(f"OTP Code: {otp_code}")
        print(f"User ID: {user_id}")
        print(f"Role: {role}")
        print(f"Remarks: {remarks}")
        print(f"{'='*60}\n")
        
        if not otp_code or not user_id:
            print("❌ Missing OTP code or user_id")
            return Response({
                'error': 'OTP code and user_id are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate remarks for substitute
        if role == 'sub' and not remarks:
            print("❌ Remarks required for substitute")
            return Response({
                'error': 'Remarks are required for substitute proctors'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find OTP record
        try:
            otp_record = TblExamOtp.objects.select_related(
                'examdetails',
                'examdetails__proctor'
            ).get(otp_code=otp_code)
            print(f"✅ Found OTP record for exam {otp_record.examdetails.examdetails_id}")
        except TblExamOtp.DoesNotExist:
            print(f"❌ OTP not found: '{otp_code}'")
            return Response({
                'error': 'Invalid OTP code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        exam_schedule = otp_record.examdetails
        
        # Check if attendance already exists
        existing_attendance = TblProctorAttendance.objects.filter(
            examdetails=exam_schedule,
            proctor_id=user_id
        ).first()
        
        if existing_attendance:
            print(f"⚠️ Attendance already exists for user {user_id}")
            return Response({
                'error': 'Attendance already recorded for this exam'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"\n💾 Creating attendance record...")
        
        with transaction.atomic():
            # Get the user object
            try:
                proctor_user = TblUsers.objects.get(user_id=user_id)
                print(f"   - Found user: {proctor_user.first_name} {proctor_user.last_name}")
            except TblUsers.DoesNotExist:
                print(f"❌ User {user_id} not found")
                return Response({
                    'error': f'User {user_id} not found'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # ✅ FIXED: Create attendance record ONLY - no status updates!
            current_time = timezone.now()
            attendance = TblProctorAttendance.objects.create(
                examdetails=exam_schedule,
                proctor=proctor_user,
                is_substitute=(role == 'sub'),
                remarks=remarks if remarks else None,
                otp_used=otp_code,
                time_in=current_time
            )
            
            print(f"✅ Created attendance record:")
            print(f"   - Attendance ID: {attendance.attendance_id}")
            print(f"   - Proctor ID: {attendance.proctor_id}")
            print(f"   - Is substitute: {attendance.is_substitute}")
            print(f"   - Time in: {attendance.time_in}")
            
            # ✅ NO MORE STATUS UPDATES - Serializer handles it!
            # The backend will automatically calculate status from attendance.time_in
            
            # If substitute, create substitution record
            if role == 'sub':
                substitution = TblProctorSubstitution.objects.create(
                    examdetails=exam_schedule,
                    original_proctor_id=exam_schedule.proctor_id,
                    substitute_proctor=proctor_user,
                    justification=remarks
                )
                print(f"✅ Created substitution record: {substitution.substitution_id}")
        
        # ✅ FIXED: Get status from serializer
        from .serializers import TblExamdetailsSerializer
        serializer = TblExamdetailsSerializer(exam_schedule)
        calculated_status = serializer.data.get('examdetails_status', 'pending')
        
        print(f"\n{'='*60}")
        print(f"✅ ATTENDANCE SUBMISSION COMPLETE")
        print(f"   - Calculated Status: {calculated_status}")
        print(f"{'='*60}\n")
        
        return Response({
            'message': 'Attendance recorded successfully',
            'attendance_id': attendance.attendance_id,
            'time_in': attendance.time_in.isoformat(),
            'status': calculated_status,  # ✅ Return calculated status
            'role': 'substitute' if attendance.is_substitute else 'assigned',
            'proctor_name': f"{proctor_user.first_name} {proctor_user.last_name}"
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ ERROR SUBMITTING ATTENDANCE")
        print(f"{'='*60}")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        return Response({
            'error': str(e),
            'detail': 'Failed to submit attendance'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ============================================================
# PROCTOR'S ASSIGNED EXAMS
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def proctor_assigned_exams(request, user_id):
    """
    Get all exams assigned to a specific proctor
    ✅ Shows exams where user is in the proctors array
    """
    try:
        # ✅ Get exams where user is assigned as proctor (single OR in array)
        exams = TblExamdetails.objects.filter(
            Q(proctor_id=user_id) | Q(proctors__contains=[user_id])
        ).select_related(
            'room',
            'room__building',
            'proctor',
            'modality',
            'modality__course'
        ).order_by('exam_date', 'exam_start_time')
        
        result = []
        for exam in exams:
            # ✅ Check if THIS SPECIFIC USER has attendance
            attendance = TblProctorAttendance.objects.filter(
                examdetails=exam,
                proctor_id=user_id  # ✅ Check for current user's attendance
            ).first()
            
            # ✅ Status is based on THIS USER's attendance, not others
            if attendance:
                if attendance.is_substitute:
                    exam_status = 'substitute'
                else:
                    # Check if late
                    if exam.exam_start_time and exam.exam_date and attendance.time_in:
                        from datetime import datetime, timedelta
                        
                        exam_date_obj = datetime.strptime(exam.exam_date, '%Y-%m-%d').date()
                        exam_start_time = exam.exam_start_time.time() if isinstance(exam.exam_start_time, datetime) else exam.exam_start_time
                        
                        exam_start_datetime = timezone.make_aware(
                            datetime.combine(exam_date_obj, exam_start_time)
                        )
                        
                        time_diff = (attendance.time_in - exam_start_datetime).total_seconds() / 60
                        exam_status = 'late' if time_diff > 7 else 'confirmed'
                    else:
                        exam_status = 'confirmed'
            else:
                # Check if exam has ended
                if exam.exam_end_time and timezone.now() > exam.exam_end_time:
                    exam_status = 'absent'
                else:
                    exam_status = 'pending'
            
            # Get instructor names
            instructor_names = []
            if exam.instructors:
                for instructor_id in exam.instructors:
                    try:
                        instructor = TblUsers.objects.get(user_id=instructor_id)
                        instructor_names.append(f"{instructor.first_name} {instructor.last_name}")
                    except TblUsers.DoesNotExist:
                        pass
            elif exam.instructor_id:
                try:
                    instructor = TblUsers.objects.get(user_id=exam.instructor_id)
                    instructor_names.append(f"{instructor.first_name} {instructor.last_name}")
                except TblUsers.DoesNotExist:
                    pass
            
            instructor_name = ', '.join(instructor_names) if instructor_names else None
            
            # Get sections display
            sections_display = ', '.join(exam.sections) if exam.sections else exam.section_name
            
            result.append({
                'id': exam.examdetails_id,
                'course_id': exam.course_id,
                'subject': exam.course_id,
                'section_name': sections_display,
                'exam_date': exam.exam_date,
                'exam_start_time': exam.exam_start_time.isoformat() if exam.exam_start_time else None,
                'exam_end_time': exam.exam_end_time.isoformat() if exam.exam_end_time else None,
                'building_name': exam.building_name,
                'room_id': exam.room.room_id if exam.room else None,
                'instructor_name': instructor_name,
                'assigned_proctor': None,  # Not needed for their own view
                'status': exam_status  # ✅ THIS USER's status
            })
        
        return Response(result, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"❌ Error fetching assigned exams: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e),
            'detail': 'Failed to fetch assigned exams'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# ALL EXAMS FOR SUBSTITUTION
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def all_exams_for_substitution(request):
    """
    Get all upcoming exams (for substitution purposes)
    """
    try:
        # Get exams starting from today
        today = timezone.now().date()
        
        exams = TblExamdetails.objects.filter(
            exam_date__gte=today.isoformat()
        ).select_related(
            'room',
            'room__building',
            'proctor',
            'modality'
        ).order_by('exam_date', 'exam_start_time')
        
        result = []
        for exam in exams:
            # Get instructor name
            instructor_name = None
            if exam.instructor_id:
                try:
                    instructor = TblUsers.objects.get(user_id=exam.instructor_id)
                    instructor_name = f"{instructor.first_name} {instructor.last_name}"
                except TblUsers.DoesNotExist:
                    pass
            
            # Get assigned proctor name
            assigned_proctor = None
            if exam.proctor:
                assigned_proctor = f"{exam.proctor.first_name} {exam.proctor.last_name}"
            
            # Check if anyone has checked in
            has_attendance = TblProctorAttendance.objects.filter(examdetails=exam).exists()
            exam_status = 'confirmed' if has_attendance else 'pending'
            
            # Get sections display
            sections_display = ', '.join(exam.sections) if exam.sections else exam.section_name
            
            result.append({
                'id': exam.examdetails_id,
                'course_id': exam.course_id,
                'subject': exam.course_id,
                'section_name': sections_display,
                'exam_date': exam.exam_date,
                'exam_start_time': exam.exam_start_time.isoformat() if exam.exam_start_time else None,
                'exam_end_time': exam.exam_end_time.isoformat() if exam.exam_end_time else None,
                'building_name': exam.building_name,
                'room_id': exam.room.room_id if exam.room else None,
                'instructor_name': instructor_name,
                'assigned_proctor': assigned_proctor,
                'status': exam_status
            })
        
        return Response(result, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"❌ Error fetching exams: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e),
            'detail': 'Failed to fetch exams'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# PROCTOR MONITORING DASHBOARD
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def proctor_monitoring_dashboard(request):
    """
    Get monitoring data - shows WHO checked in for each exam
    """
    try:
        college_name = request.GET.get('college_name')
        exam_date = request.GET.get('exam_date')
        
        queryset = TblExamdetails.objects.select_related(
            'room',
            'room__building',
            'proctor',
            'modality'
        ).prefetch_related(
            'attendance_records',
            'attendance_records__proctor'
        )
        
        if college_name:
            queryset = queryset.filter(college_name=college_name)
        if exam_date:
            queryset = queryset.filter(exam_date=exam_date)
        
        queryset = queryset.order_by('exam_date', 'exam_start_time')
        
        result = []
        for exam in queryset:
            # Get OTP code
            try:
                otp_record = TblExamOtp.objects.filter(examdetails=exam).first()
                otp_code = otp_record.otp_code if otp_record else None
            except Exception:
                otp_code = None
            
            # ✅ FIXED: Check attendance for ALL assigned proctors
            all_proctors = []
            
            # Get assigned proctor IDs
            if exam.proctors:
                assigned_proctor_ids = exam.proctors
            elif exam.proctor_id:
                assigned_proctor_ids = [exam.proctor_id]
            else:
                assigned_proctor_ids = []
            
            # Check each proctor's status
            proctor_statuses = []
            for proctor_id in assigned_proctor_ids:
                try:
                    proctor = TblUsers.objects.get(user_id=proctor_id)
                    proctor_name = f"{proctor.first_name} {proctor.last_name}"
                    
                    # Check if THIS proctor has attendance
                    attendance = exam.attendance_records.filter(proctor_id=proctor_id).first()
                    
                    if attendance:
                        if attendance.is_substitute:
                            status = 'substitute'
                        else:
                            # Check if late
                            if exam.exam_start_time and exam.exam_date and attendance.time_in:
                                from datetime import datetime, timedelta
                                
                                exam_date_obj = datetime.strptime(exam.exam_date, '%Y-%m-%d').date()
                                exam_start_time = exam.exam_start_time.time() if isinstance(exam.exam_start_time, datetime) else exam.exam_start_time
                                
                                exam_start_datetime = timezone.make_aware(
                                    datetime.combine(exam_date_obj, exam_start_time)
                                )
                                
                                time_diff = (attendance.time_in - exam_start_datetime).total_seconds() / 60
                                status = 'late' if time_diff > 7 else 'confirmed'
                            else:
                                status = 'confirmed'
                        
                        time_in = attendance.time_in
                    else:
                        # No attendance yet
                        if exam.exam_end_time and timezone.now() > exam.exam_end_time:
                            status = 'absent'
                        else:
                            status = 'pending'
                        time_in = None
                    
                    proctor_statuses.append({
                        'proctor_id': proctor_id,
                        'proctor_name': proctor_name,
                        'status': status,
                        'time_in': time_in.isoformat() if time_in else None
                    })
                    
                except TblUsers.DoesNotExist:
                    continue
            
            # ✅ Format proctor names with status indicators
            proctor_display = ', '.join([
                f"{p['proctor_name']} ({'✓' if p['status'] in ['confirmed', 'late'] else '✗'})"
                for p in proctor_statuses
            ])
            
            # Overall exam status (if ANY proctor checked in, show confirmed)
            has_any_attendance = any(p['status'] in ['confirmed', 'late', 'substitute'] for p in proctor_statuses)
            overall_status = 'confirmed' if has_any_attendance else 'pending'
            
            # Get instructor names
            instructor_names = []
            if exam.instructors:
                for instructor_id in exam.instructors:
                    try:
                        instructor = TblUsers.objects.get(user_id=instructor_id)
                        instructor_names.append(f"{instructor.first_name} {instructor.last_name}")
                    except TblUsers.DoesNotExist:
                        pass
            elif exam.instructor_id:
                try:
                    instructor = TblUsers.objects.get(user_id=exam.instructor_id)
                    instructor_names.append(f"{instructor.first_name} {instructor.last_name}")
                except TblUsers.DoesNotExist:
                    pass
            
            instructor_name = ', '.join(instructor_names) if instructor_names else None
            
            sections_display = ', '.join(exam.sections) if exam.sections else exam.section_name
            
            result.append({
                'id': exam.examdetails_id,
                'course_id': exam.course_id,
                'subject': exam.course_id,
                'section_name': sections_display,
                'exam_date': exam.exam_date,
                'exam_start_time': exam.exam_start_time.isoformat() if exam.exam_start_time else None,
                'exam_end_time': exam.exam_end_time.isoformat() if exam.exam_end_time else None,
                'building_name': exam.building_name,
                'room_id': exam.room.room_id if exam.room else None,
                'proctor_name': proctor_display,  # ✅ All proctors with status
                'proctor_details': proctor_statuses,  # ✅ Detailed info
                'instructor_name': instructor_name,
                'department': exam.college_name,
                'college': exam.college_name,
                'status': overall_status,
                'code_entry_time': proctor_statuses[0]['time_in'] if proctor_statuses and proctor_statuses[0]['time_in'] else None,
                'otp_code': otp_code
            })
        
        return Response(result, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"❌ Error fetching monitoring data: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e),
            'detail': 'Failed to fetch monitoring data'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ============================================================
# Available Rooms
# ============================================================
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_available_rooms_list(request):
    if request.method == 'GET':
        college_id = request.GET.get('college_id')
        room_id = request.GET.get('room_id')
        
        queryset = TblAvailableRooms.objects.all()
        
        if college_id:
            queryset = queryset.filter(college_id=college_id)
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        
        serializer = TblAvailableRoomsSerializer(queryset, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        # Log the incoming data for debugging
        print("📥 Incoming available_rooms POST data:", request.data)
        
        serializer = TblAvailableRoomsSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                print("❌ Error saving available room:", str(e))
                return Response({
                    'error': str(e),
                    'detail': 'Failed to save available room'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Log validation errors
        print("❌ Validation errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([AllowAny])
def tbl_available_rooms_delete(request, room_id, college_id):
    try:
        available_room = TblAvailableRooms.objects.get(room_id=room_id, college_id=college_id)
        available_room.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except TblAvailableRooms.DoesNotExist:
        return Response({'error': 'Available room not found'}, status=status.HTTP_404_NOT_FOUND)
    
@api_view(['GET'])
def proctors_list(request, scheduler_id: int):
    """
    Get all proctors under the same college(s) as scheduler.
    """
    scheduler_roles = TblUserRole.objects.filter(user_id=scheduler_id, role_id=3)
    college_ids = [r.college_id for r in scheduler_roles if r.college_id]

    proctor_roles = TblUserRole.objects.filter(college_id__in=college_ids, role_id=5)
    proctor_ids = [r.user_id for r in proctor_roles]

    proctors = TblUsers.objects.filter(user_id__in=proctor_ids).values(
        'user_id', 'first_name', 'last_name', 'email_address'
    )
    return Response(list(proctors))

# ============================================================
# Email Notifications
# ============================================================
@api_view(['POST'])
def send_email_notification(request):
    """
    Send notifications to selected users
    """
    serializer = EmailNotificationSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"message": f"Email sent to {len(request.data.get('user_ids', []))} user(s)!"}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ============================================================
# Notfication
# ============================================================
@api_view(['GET'])
@permission_classes([AllowAny])
def notification_list(request, user_id):
    """
    Get all notifications for a user, ordered by priority and created_at
    """
    notifications = TblNotification.objects.select_related(
        'user',
        'sender'
    ).filter(user_id=user_id).order_by('-priority', '-created_at')
    serializer = TblNotificationSerializer(notifications, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def notification_create(request):
    """
    Create a new notification
    """
    serializer = TblNotificationSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH'])
@permission_classes([AllowAny])
def notification_update(request, pk):
    """
    Update a notification (e.g., mark as seen)
    """
    try:
        notification = TblNotification.objects.get(pk=pk)
    except TblNotification.DoesNotExist:
        return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = TblNotificationSerializer(notification, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([AllowAny])
def notification_delete(request, pk):
    """
    Delete a notification
    """
    try:
        notification = TblNotification.objects.get(pk=pk)
        notification.delete()
        return Response({"message": "Notification deleted"}, status=status.HTTP_204_NO_CONTENT)
    except TblNotification.DoesNotExist:
        return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

# ============================================================
# Send Schedule to Dean
# ============================================================    
@api_view(['POST'])
@permission_classes([AllowAny])
def send_schedule_to_dean(request):
    """
    Send schedule approval request to dean
    """
    serializer = ScheduleSendSerializer(data=request.data)
    if not serializer.is_valid():
        print("❌ Validation errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user_id = request.data.get("user_id")
    if not user_id:
        return Response({"error": "Missing user_id"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        print(f"📥 Received request from user_id: {user_id}")
        print(f"📋 College: {serializer.validated_data.get('college_name')}")

        # 1️⃣ Find scheduler's college (role_id = 3)
        scheduler_role = TblUserRole.objects.filter(user_id=user_id, role_id=3).first()
        if not scheduler_role:
            print(f"❌ No scheduler role found for user {user_id}")
            return Response(
                {"error": "User is not a scheduler or has no college"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        print(f"✅ Found scheduler role - College ID: {scheduler_role.college_id}")

        # 2️⃣ Find dean in the same college (role_id = 1)
        dean_role = TblUserRole.objects.filter(
            college_id=scheduler_role.college_id, 
            role_id=1
        ).first()
        
        if not dean_role:
            print(f"❌ No dean found for college {scheduler_role.college_id}")
            return Response(
                {"error": "No dean found for this college"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        print(f"✅ Found dean role - User ID: {dean_role.user_id}")

        dean_user = TblUsers.objects.filter(user_id=dean_role.user_id).first()
        if not dean_user:
            print(f"❌ Dean user record not found for user_id {dean_role.user_id}")
            return Response(
                {"error": "Dean user record not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        print(f"✅ Found dean user: {dean_user.first_name} {dean_user.last_name}")

        # 3️⃣ Create schedule approval record with scheduler's user_id
        request_id = uuid4()
        schedule_data = {
            "college_name": serializer.validated_data["college_name"],
            "exam_period": serializer.validated_data["exam_period"],
            "term": serializer.validated_data["term"],
            "semester": serializer.validated_data["semester"],
            "academic_year": serializer.validated_data["academic_year"],
            "building": serializer.validated_data["building"],
            "total_schedules": len(serializer.validated_data["schedules"]),
            "schedules": serializer.validated_data["schedules"],
            "submitted_by_id": user_id,  # ✅ ADD THIS - Store scheduler's ID
        }

        print(f"📦 Creating schedule approval record...")
        approval = TblScheduleapproval.objects.create(
            request_id=request_id,
            submitted_by_id=user_id,  # ✅ This is the scheduler's user_id
            dean_user_id=dean_role.user_id,
            college_name=serializer.validated_data["college_name"],
            schedule_data=schedule_data,
            remarks=serializer.validated_data.get("remarks", "No remarks"),
            status="pending",
            submitted_at=timezone.now(),
            created_at=timezone.now(),
        )
        print(f"✅ Created approval record: {request_id}")
        print(f"   - Status: {approval.status}")
        print(f"   - College: {approval.college_name}")
        print(f"   - Dean ID: {approval.dean_user_id}")
        print(f"   - Scheduler ID: {approval.submitted_by_id}")  # ✅ Log this

        # 4️⃣ Send dean notification
        print(f"📧 Creating notification for dean user_id: {dean_role.user_id}")
        notification = TblNotification.objects.create(
            user_id=dean_role.user_id,
            sender_id=user_id,  # ✅ This is the scheduler
            title="New Schedule Approval Request",
            message=f"Scheduler submitted a schedule for {serializer.validated_data['college_name']}.",
            type="schedule_approval",
            status="unread",
            link_url="/dean-requests",
            is_seen=False,
            priority=1,
            created_at=timezone.now(),
        )
        print(f"✅ Created notification: {notification.notification_id}")
        print(f"   - For user: {notification.user_id}")
        print(f"   - From user: {notification.sender_id}")
        print(f"   - Title: {notification.title}")

        return Response(
            {
                "message": "Schedule successfully sent to Dean.",
                "request_id": str(request_id),
                "dean_name": f"{dean_user.first_name} {dean_user.last_name}",
                "dean_user_id": dean_user.user_id,
                "scheduler_user_id": user_id,  # ✅ Return scheduler ID
                "total_schedules": len(serializer.validated_data["schedules"]),
                "college_name": serializer.validated_data["college_name"],
                "status": "pending"
            },
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        print(f"💥 Error sending schedule: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {"error": str(e), "detail": "Internal server error"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
# ============================================================
# Approve Schedule by Dean
# ============================================================   
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_scheduleapproval_list(request):
    if request.method == 'GET':
        # ✅ FIX: Add query parameter filtering
        approvals = TblScheduleapproval.objects.select_related('submitted_by').all().order_by('-created_at')
        
        # Filter by status (e.g., 'pending', 'approved', 'rejected')
        status = request.GET.get('status')
        if status:
            approvals = approvals.filter(status=status)
        
        # Filter by college_name
        college_name = request.GET.get('college_name')
        if college_name:
            approvals = approvals.filter(college_name=college_name)
        
        # Optional: Filter by limit
        limit = request.GET.get('limit')
        if limit:
            try:
                approvals = approvals[:int(limit)]
            except ValueError:
                pass
        
        print(f"🔍 Fetching approvals - status: {status}, college: {college_name}, count: {approvals.count()}")
        
        serializer = TblScheduleapprovalSerializer(approvals, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TblScheduleapprovalSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_scheduleapproval_detail(request, pk):
    """
    GET → Retrieve  
    PUT → Update  
    DELETE → Delete  
    """
    try:
        approval = TblScheduleapproval.objects.get(pk=pk)
    except TblScheduleapproval.DoesNotExist:
        return Response({'error': 'Schedule approval not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TblScheduleapprovalSerializer(approval)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TblScheduleapprovalSerializer(approval, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        approval.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# ============================================================
# Exam Details Management
# ============================================================   
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_examdetails_list(request):
    if request.method == 'GET':
        try:
            queryset = TblExamdetails.objects.select_related(
                'room',
                'room__building',
                'modality',
                'modality__course',
                'modality__user',
                'proctor',
                'examperiod'
            ).all()

            # ✅ ADD: Filter by proctor_id (supports both single proctor and proctors array)
            proctor_id = request.GET.get('proctor_id')
            if proctor_id:
                try:
                    proctor_id_int = int(proctor_id)
                    queryset = queryset.filter(
                        Q(proctor_id=proctor_id_int) |
                        Q(proctors__overlap=[proctor_id_int])
                    )
                    print(f"Filtering by proctor_id={proctor_id_int}")
                except ValueError:
                    print(f"Invalid proctor_id received: {proctor_id}")

            # ✅ Existing filters
            college_name = request.GET.get('college_name')
            room_id = request.GET.get('room_id')
            exam_date = request.GET.get('exam_date')
            modality_id = request.GET.get('modality_id')

            if college_name:
                queryset = queryset.filter(college_name=college_name)
            if room_id:
                queryset = queryset.filter(room__room_id=room_id)
            if exam_date:
                queryset = queryset.filter(exam_date=exam_date)
            if modality_id:
                modality_ids = [mid.strip() for mid in modality_id.split(',') if mid.strip()]
                queryset = queryset.filter(modality_id__in=modality_ids)

            print(f"✅ Found {queryset.count()} exam schedules")
            
            serializer = TblExamdetailsSerializer(queryset, many=True)
            return Response(serializer.data)
        
        except Exception as e:
            print(f"❌ Error in tbl_examdetails GET: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {'error': str(e), 'detail': 'Failed to fetch exam details'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    elif request.method == 'POST':
        many = isinstance(request.data, list)
        print("📦 Incoming exam details data:", request.data)
        serializer = TblExamdetailsSerializer(data=request.data, many=many)
        if serializer.is_valid():
            try:
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                print(f"❌ Error saving exam details: {str(e)}")
                import traceback
                traceback.print_exc()
                return Response(
                    {'error': str(e), 'detail': 'Failed to save exam details'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        print("❌ Validation errors:", serializer.errors)
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
        try:
            queryset = TblModality.objects.select_related(
                'course',
                'course__term',
                'room',
                'room__building',
                'user'
            ).all()

            # Optional filtering by query params
            course_id = request.GET.get('course_id')
            program_id = request.GET.get('program_id')
            section_name = request.GET.get('section_name')
            modality_type = request.GET.get('modality_type')
            room_type = request.GET.get('room_type')
            user_id = request.GET.get('user_id')  # ✅ ADD THIS

            print(f"📥 Modality GET request - course_id: {course_id}, program_id: {program_id}, user_id: {user_id}")

            # ✅ ADD: Filter by user_id
            if user_id:
                queryset = queryset.filter(user__user_id=user_id)
                print(f"🔍 Filtering by user_id: {user_id}")

            # Handle comma-separated course_ids
            if course_id:
                course_ids = [cid.strip() for cid in course_id.split(',') if cid.strip()]
                print(f"🔍 Filtering by course_ids: {course_ids}")
                queryset = queryset.filter(course_id__in=course_ids)
            
            # Handle comma-separated program_ids
            if program_id:
                program_ids = [pid.strip() for pid in program_id.split(',') if pid.strip()]
                print(f"🔍 Filtering by program_ids: {program_ids}")
                queryset = queryset.filter(program_id__in=program_ids)
            
            if section_name:
                queryset = queryset.filter(section_name=section_name)
            if modality_type:
                queryset = queryset.filter(modality_type=modality_type)
            if room_type:
                queryset = queryset.filter(room_type=room_type)

            print(f"✅ Found {queryset.count()} modalities")
            
            serializer = TblModalitySerializer(queryset, many=True)
            return Response(serializer.data)
        
        except Exception as e:
            print(f"❌ Error in tbl_modality_list: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {'error': str(e), 'detail': 'Failed to fetch modalities'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'POST':
        # ✅ ADD: Log incoming data
        print("📥 Incoming modality POST data:", request.data)
        
        serializer = TblModalitySerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save()
                print(f"✅ Modality created: ID {serializer.data.get('modality_id')}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                print(f"❌ Error saving modality: {str(e)}")
                return Response({
                    'error': str(e),
                    'detail': 'Failed to save modality'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"❌ Validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
@api_view(['POST'])
@permission_classes([AllowAny])
def tbl_examdetails_batch_delete(request):
    """
    Delete multiple exam details by college_name or list of IDs
    """
    college_name = request.data.get('college_name')
    exam_ids = request.data.get('exam_ids', [])
    
    try:
        if college_name:
            # Delete all exams for a specific college
            deleted_count, _ = TblExamdetails.objects.filter(
                college_name=college_name
            ).delete()
            
            return Response({
                'message': f'Successfully deleted {deleted_count} schedules',
                'deleted_count': deleted_count
            }, status=status.HTTP_200_OK)
            
        elif exam_ids:
            # Delete specific exam IDs
            deleted_count, _ = TblExamdetails.objects.filter(
                examdetails_id__in=exam_ids
            ).delete()
            
            return Response({
                'message': f'Successfully deleted {deleted_count} schedules',
                'deleted_count': deleted_count
            }, status=status.HTTP_200_OK)
        
        else:
            return Response({
                'error': 'Either college_name or exam_ids must be provided'
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        print(f"❌ Error in batch delete: {str(e)}")
        return Response({
            'error': str(e),
            'detail': 'Failed to delete exam details'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
        print(f"🗑️ Deleting modality {pk}")
        instance.delete()
        print(f"✅ Modality {pk} deleted successfully")
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([AllowAny])
def tbl_availability_list(request):
    if request.method == 'GET':
        # Support single or multiple user IDs
        user_id = request.GET.get('user_id')
        user_ids = request.GET.get('user_ids')  # comma-separated string of user IDs
        college_id = request.GET.get('college_id')
        status_param = request.GET.get('status')
        days = request.GET.getlist('days[]') or request.GET.getlist('days')

        availabilities = TblAvailability.objects.select_related('user').all()

        # Filter by single user
        if user_id:
            availabilities = availabilities.filter(user__user_id=user_id)
        # Filter by multiple users
        elif user_ids:
            user_id_list = [int(uid.strip()) for uid in user_ids.split(',') if uid.strip().isdigit()]
            availabilities = availabilities.filter(user__user_id__in=user_id_list)

        if college_id:
            availabilities = availabilities.filter(user__college_id=college_id)

        if status_param:
            availabilities = availabilities.filter(status=status_param)

        if days:
            availabilities = availabilities.filter(days__overlap=days)

        serializer = TblAvailabilitySerializer(availabilities, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data
        if isinstance(data, list):
            serializer = TblAvailabilitySerializer(data=data, many=True)
        else:
            serializer = TblAvailabilitySerializer(data=data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        user_id = request.GET.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id parameter is required for bulk delete'},
                status=status.HTTP_400_BAD_REQUEST
            )
        deleted_count, _ = TblAvailability.objects.filter(user__user_id=user_id).delete()
        return Response(
            {'message': f'Deleted {deleted_count} availability record(s) for user {user_id}'},
            status=status.HTTP_200_OK
        )

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
        user_id = request.GET.get('user_id')
        is_bayanihan_leader = request.GET.get('is_bayanihan_leader')
        
        course_users = TblCourseUsers.objects.select_related('course', 'user').all()
        
        if user_id:
            course_users = course_users.filter(user__user_id=user_id)
        
        # ✅ ADD THIS
        if is_bayanihan_leader:
            if is_bayanihan_leader.lower() == 'true':
                course_users = course_users.filter(is_bayanihan_leader=True)
        
        serializer = TblCourseUsersSerializer(course_users, many=True)
        return Response(serializer.data)

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
        qs = TblSectioncourse.objects.select_related(
            'course',
            'course__term',
            'program',
            'program__department',
            'term',
            'user'
        ).all()

        serializer = TblSectioncourseSerializer(qs, many=True)
        return Response(serializer.data)  # ✅ Simple array, paginate on frontend

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

@cache_page(60 * 5)    
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
        # Log incoming data for debugging
        print("📥 Creating account with data:", request.data)
        
        serializer = TblUsersSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # The serializer's create method will handle password hashing
                user = serializer.save()
                print(f"✅ Account created: {user.user_id} - {user.first_name} {user.last_name}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                print(f"❌ Error creating account: {str(e)}")
                return Response({
                    'error': str(e),
                    'detail': 'Failed to create account'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"❌ Validation errors: {serializer.errors}")
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

@cache_page(60 * 5)    
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

@cache_page(60 * 3)
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
        courses = TblCourse.objects.select_related('term').prefetch_related('tblcourseusers_set__user').all()
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

@cache_page(60 * 3)    
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

@cache_page(60 * 3)     
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

@cache_page(60 * 5)
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
        token = secrets.token_urlsafe(32)
        uid = str(user.pk)

        cache_key = f"password_reset_{uid}"
        cache.set(cache_key, token, timeout=15 * 60)

        reset_link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

        subject = "Password Reset Request"
        message = (
            f"Hi {user.first_name},\n\n"
            f"You recently requested to reset your password.\n\n"
            f"Click the link below to set a new one:\n\n{reset_link}\n\n"
            f"This link will expire in 15 minutes.\n\n"
            f"Best,\nExamSync Team"
        )

        def send_email_async():
            try:
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email])
                print(f"✅ Password reset email sent to {email}")
            except Exception as e:
                print(f"❌ Failed to send email: {str(e)}")

        # Start background thread
        Thread(target=send_email_async).start()

        # ✅ Return immediately without waiting for email
        return Response({
            'message': 'Password reset link will be sent to your email shortly!'
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"❌ Error in password reset: {str(e)}")
        return Response({
            'error': 'Failed to process password reset request.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def send_proctor_emails(request):
    """
    Send real Gmail emails to proctors with their personalized schedules
    """
    try:
        emails_data = request.data.get('emails', [])
        sender_id = request.data.get('sender_id')
        
        if not emails_data:
            return Response(
                {'error': 'No emails to send'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sent_count = 0
        failed_emails = []
        
        for email_data in emails_data:
            proctor_email = email_data.get('email')
            proctor_name = email_data.get('name')
            subject = email_data.get('subject')
            message = email_data.get('message')
            
            if not all([proctor_email, subject, message]):
                failed_emails.append({
                    'email': proctor_email,
                    'reason': 'Missing required fields'
                })
                continue
            
            try:
                # Send actual email via Gmail SMTP
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[proctor_email],
                    fail_silently=False,
                )
                
                # Also create in-app notification for record
                TblNotification.objects.create(
                    user_id=email_data.get('user_id'),
                    sender_id=sender_id,
                    title=subject,
                    message=message,
                    type='email',
                    status='sent',
                    is_seen=False,
                    priority=2,
                    created_at=timezone.now()
                )
                
                sent_count += 1
                print(f"✅ Email sent to {proctor_name} ({proctor_email})")
                
            except Exception as e:
                print(f"❌ Failed to send email to {proctor_email}: {str(e)}")
                failed_emails.append({
                    'email': proctor_email,
                    'name': proctor_name,
                    'reason': str(e)
                })
        
        response_data = {
            'sent_count': sent_count,
            'total_count': len(emails_data),
            'success': sent_count > 0
        }
        
        if failed_emails:
            response_data['failed_emails'] = failed_emails
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"💥 Error in send_proctor_emails: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': str(e), 'detail': 'Failed to send emails'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
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
# ============================================================
# LOGIN ENDPOINT
# ============================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def login_faculty(request):
    user_id = request.data.get('user_id')
    password = request.data.get('password')

    if not user_id or not password:
        return Response({'message': 'User ID and password required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = TblUsers.objects.get(user_id=user_id)
        print(f"🔍 Attempting login for {user_id}")

        # Check account status
        print(f"User status from DB: {user.status}")
        if user.status and user.status.lower() != 'active':
            print("❌ Account inactive")
            return Response({'message': 'Account is not active'}, status=status.HTTP_401_UNAUTHORIZED)

        # Check password hash
        if not check_password(password, user.password):
            print("❌ Password mismatch")
            return Response({'message': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        # Token generation
        token = secrets.token_hex(16)

        # Get roles (case-insensitive)
        user_roles = TblUserRole.objects.filter(user=user, status__iexact='active')
        roles_data = UserRoleSerializer(user_roles, many=True).data
        print("✅ Roles found:", roles_data)

        return Response({
            'token': token,
            'user_id': user.user_id,
            'email': user.email_address,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'roles': roles_data
        }, status=status.HTTP_200_OK)

    except TblUsers.DoesNotExist:
        print("❌ No such user found")
        return Response({'message': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    except Exception as e:
        print("💥 Server error:", str(e))
        return

# ============================================================
# PASSWORD RESET CONFIRMATION
# ============================================================
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def confirm_password_change(request):
    uid = request.data.get("uid")
    token = request.data.get("token")
    new_password = request.data.get("new_password")

    if not all([uid, token, new_password]):
        return Response({"error": "Missing fields"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = TblUsers.objects.get(pk=uid)
    except TblUsers.DoesNotExist:
        return Response({"error": "Invalid user"}, status=status.HTTP_404_NOT_FOUND)

    cache_key = f"password_reset_{uid}"
    stored_token = cache.get(cache_key)

    if not stored_token or stored_token != token:
        return Response({"error": "Invalid or expired link."}, status=status.HTTP_400_BAD_REQUEST)

    # Hash and save new password
    user.password = make_password(new_password)
    user.save()

    cache.delete(cache_key)

    print(f"✅ Password successfully changed for user {user.user_id}")
    return Response({"message": "Password changed successfully!"}, status=status.HTTP_200_OK)

# ============================================================
# CHANGE PROCTOR
# ============================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def user_avatar_upload(request, user_id):
    """
    Upload user avatar image
    """
    try:
        user = TblUsers.objects.get(user_id=user_id)
    except TblUsers.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get uploaded file
    avatar_file = request.FILES.get('avatar')
    if not avatar_file:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if avatar_file.content_type not in allowed_types:
        return Response({
            'error': 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate file size (max 5MB)
    if avatar_file.size > 5 * 1024 * 1024:
        return Response({
            'error': 'File too large. Maximum size is 5MB'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Import required libraries
        import base64
        from io import BytesIO
        from PIL import Image
        
        # Open and resize image
        img = Image.open(avatar_file)
        
        # Convert to RGB if needed (for PNG with transparency)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Resize to max 400x400 while maintaining aspect ratio
        img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        
        # Save to BytesIO
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=85, optimize=True)
        buffer.seek(0)
        
        # Convert to base64 data URL
        img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        avatar_url = f"data:image/jpeg;base64,{img_base64}"
        
        # Update user avatar
        user.avatar_url = avatar_url
        user.save()
        
        return Response({
            'message': 'Avatar uploaded successfully',
            'avatar_url': avatar_url
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"❌ Error processing avatar: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': 'Failed to process image',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def user_avatar_delete(request, user_id):
    """
    Delete user avatar
    """
    try:
        user = TblUsers.objects.get(user_id=user_id)
    except TblUsers.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Clear avatar
    user.avatar_url = None
    user.save()
    
    return Response({
        'message': 'Avatar deleted successfully'
    }, status=status.HTTP_200_OK)

# ============================================================
# CREATE ACCOUNT (HASHES PASSWORD)
# ============================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def create_account_with_password(request):
    """
    Create a new account with hashed password.
    Expects: user_id, first_name, last_name, email_address, contact_number, password (optional)
    If no password provided, generates default: LastName@user_id
    """
    try:
        data = request.data.copy()
        
        # Generate default password if not provided
        if not data.get('password'):
            last_name = data.get('last_name', '')
            user_id = data.get('user_id', '')
            data['password'] = f"{last_name}@{user_id}"
        
        print(f"📥 Creating account for user {data.get('user_id')} with data: {data}")
        
        serializer = TblUsersSerializer(data=data)
        if serializer.is_valid():
            user = serializer.save()
            print(f"✅ Account created successfully: {user.user_id}")
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        
        print(f"❌ Serializer validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        print(f"❌ Error creating account: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e),
            'detail': 'Failed to create account'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ============================================================
# USERS LIST
# ============================================================
@api_view(['GET'])
@permission_classes([AllowAny])
def users_list(request):
    users = TblUsers.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# ============================================================
# SINGLE USER DETAIL
# ============================================================
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
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method in ['PUT', 'PATCH']:
        serializer = UserSerializer(user, data=request.data, partial=(request.method == 'PATCH'))
        if serializer.is_valid():
            updated_user = serializer.save()
            password = request.data.get('password')
            if password:
                updated_user.password = make_password(password)
                updated_user.save()
            return Response(UserSerializer(updated_user).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

@api_view(['GET', 'POST', 'DELETE'])  # ✅ Add DELETE
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
    
    elif request.method == 'DELETE':  # ✅ ADD THIS
        # Delete ALL exam periods
        deleted_count, _ = TblExamperiod.objects.all().delete()
        return Response({
            'message': f'Deleted {deleted_count} exam period(s)'
        }, status=204)

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
        queryset = TblUserRole.objects.select_related(
            'role',
            'college',
            'department',
            'department__college',
            'user'
        ).all()

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

@cache_page(60 * 5)     
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

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def tbl_schedule_footer_list(request):
    if request.method == 'GET':
        college_id = request.GET.get('college_id')
        
        if college_id:
            footers = TblScheduleFooter.objects.filter(college_id=college_id)
        else:
            footers = TblScheduleFooter.objects.all()
        
        serializer = TblScheduleFooterSerializer(footers, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = TblScheduleFooterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def tbl_schedule_footer_detail(request, pk):
    try:
        footer = TblScheduleFooter.objects.get(pk=pk)
    except TblScheduleFooter.DoesNotExist:
        return Response({'error': 'Footer not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = TblScheduleFooterSerializer(footer)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        serializer = TblScheduleFooterSerializer(footer, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        footer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([AllowAny])
def upload_schedule_logo(request):
    """
    Upload logo for schedule footer
    """
    college_id = request.data.get('college_id')
    logo_file = request.FILES.get('logo')
    
    if not logo_file:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if logo_file.content_type not in allowed_types:
        return Response({
            'error': 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        
        # Open and resize image
        img = Image.open(logo_file)
        
        # Convert to RGB if needed
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Resize to max 400x400
        img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        
        # Save to BytesIO
        buffer = BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        
        # Convert to base64
        img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        logo_url = f"data:image/png;base64,{img_base64}"
        
        return Response({
            'message': 'Logo uploaded successfully',
            'logo_url': logo_url
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"❌ Error processing logo: {str(e)}")
        return Response({
            'error': 'Failed to process image',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)