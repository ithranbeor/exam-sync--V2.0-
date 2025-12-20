# exam-sync-v2/backend/api/views.py

from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework import status
from rest_framework import status as http_status
from django.views.decorators.cache import cache_page
from datetime import datetime, time
from django.db.models import Q
from .models import TblUsers, TblScheduleapproval, TblProctorAttendanceHistory, TblScheduleFooter, TblProctorSubstitution, TblProctorAttendance, TblExamOtp, TblAvailableRooms, TblNotification, TblUserRole, TblExamdetails, TblModality, TblAvailability, TblCourseUsers, TblSectioncourse, TblUserRoleHistory, TblRoles, TblBuildings, TblRooms, TblCourse, TblExamperiod, TblProgram, TblTerm, TblCollege, TblDepartment
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
        user_id = request.GET.get('user_id')
        
        if not user_id:
            return Response({
                'error': 'user_id parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = TblUsers.objects.get(user_id=user_id)
        
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
            'otp_records': otp_records[:10]  
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

        now = timezone.now()

        if now > otp_record.expires_at:
            return Response({
                'valid': False,
                'message': 'OTP code has expired'
            }, status=status.HTTP_200_OK)

        exam_schedule = otp_record.examdetails

        if exam_schedule.exam_start_time and exam_schedule.exam_end_time:
            try:
                if isinstance(exam_schedule.exam_start_time, datetime):
                    exam_start_datetime = (
                        timezone.make_aware(exam_schedule.exam_start_time)
                        if timezone.is_naive(exam_schedule.exam_start_time)
                        else exam_schedule.exam_start_time
                    )
                else:
                    exam_date_obj = datetime.strptime(
                        exam_schedule.exam_date, '%Y-%m-%d'
                    ).date()
                    exam_start_datetime = timezone.make_aware(
                        datetime.combine(
                            exam_date_obj, exam_schedule.exam_start_time
                        )
                    )

                if isinstance(exam_schedule.exam_end_time, datetime):
                    exam_end_datetime = (
                        timezone.make_aware(exam_schedule.exam_end_time)
                        if timezone.is_naive(exam_schedule.exam_end_time)
                        else exam_schedule.exam_end_time
                    )
                else:
                    exam_date_obj = datetime.strptime(
                        exam_schedule.exam_date, '%Y-%m-%d'
                    ).date()
                    exam_end_datetime = timezone.make_aware(
                        datetime.combine(
                            exam_date_obj, exam_schedule.exam_end_time
                        )
                    )

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

            except Exception:
                pass

        is_assigned = False
        assigned_proctor_name = None

        if exam_schedule.proctor_id == user_id:
            is_assigned = True
        elif exam_schedule.proctors and user_id in exam_schedule.proctors:
            is_assigned = True

        if exam_schedule.proctor:
            assigned_proctor_name = (
                f"{exam_schedule.proctor.first_name} "
                f"{exam_schedule.proctor.last_name}"
            )

        verification_status = (
            "valid-assigned" if is_assigned else "valid-not-assigned"
        )
        message = (
            "OTP verified. You are assigned to this exam."
            if is_assigned
            else "OTP is valid, but you are not the assigned proctor. Do you want to substitute?"
        )

        sections_display = (
            ', '.join(exam_schedule.sections)
            if exam_schedule.sections
            else exam_schedule.section_name
        )

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
        
        if not otp_code or not user_id:
            return Response({
                'error': 'OTP code and user_id are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # ONLY validate remarks for substitute role
        if role == 'sub' and not remarks:
            return Response({
                'error': 'Remarks are required when substituting for another proctor'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find OTP record
        try:
            otp_record = TblExamOtp.objects.select_related(
                'examdetails',
                'examdetails__proctor'
            ).get(otp_code=otp_code)
        except TblExamOtp.DoesNotExist:
            return Response({
                'error': 'Invalid OTP code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        exam_schedule = otp_record.examdetails
        
        # Check if THIS USER already has attendance for THIS EXAM
        existing_attendance = TblProctorAttendance.objects.filter(
            examdetails=exam_schedule,
            proctor_id=user_id
        ).first()
        
        if existing_attendance:
            return Response({
                'error': 'You have already recorded attendance for this exam'
            }, status=status.HTTP_400_BAD_REQUEST)
                
        with transaction.atomic():
            # Get the user object
            try:
                proctor_user = TblUsers.objects.get(user_id=user_id)
            except TblUsers.DoesNotExist:
                return Response({
                    'error': f'User {user_id} not found'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create NEW attendance record
            current_time = timezone.now()
            attendance = TblProctorAttendance.objects.create(
                examdetails=exam_schedule,
                proctor=proctor_user,
                is_substitute=(role == 'sub'), 
                remarks=remarks if remarks else None,
                otp_used=otp_code,
                time_in=current_time
            )
            
            # ONLY create substitution record if role is 'sub'
            if role == 'sub':
                original_proctor_name = None
                if exam_schedule.proctor:
                    original_proctor_name = f"{exam_schedule.proctor.first_name} {exam_schedule.proctor.last_name}"
                
                substitution = TblProctorSubstitution.objects.create(
                    examdetails=exam_schedule,
                    original_proctor=exam_schedule.proctor,  
                    substitute_proctor=proctor_user,
                    justification=remarks
                )

        # Get status from serializer
        from .serializers import TblExamdetailsSerializer
        serializer = TblExamdetailsSerializer(exam_schedule)
        calculated_status = serializer.data.get('examdetails_status', 'pending')
        
        return Response({
            'message': 'Attendance recorded successfully',
            'attendance_id': attendance.attendance_id,
            'time_in': attendance.time_in.isoformat(),
            'status': calculated_status,
            'role': 'substitute' if attendance.is_substitute else 'assigned',
            'proctor_name': f"{proctor_user.first_name} {proctor_user.last_name}"
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e),
            'detail': 'Failed to submit attendance'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ============================================================
# PROCTOR'S ASSIGNED EXAMS
# ============================================================

def build_exam_datetime(exam_date, exam_time):
    """
    Safely returns an aware datetime for an exam time
    Handles:
    - datetime
    - time
    """
    if isinstance(exam_time, datetime):
        return timezone.make_aware(exam_time) if timezone.is_naive(exam_time) else exam_time

    if isinstance(exam_time, time):
        if isinstance(exam_date, str):
            exam_date = datetime.strptime(exam_date, "%Y-%m-%d").date()

        dt = datetime.combine(exam_date, exam_time)
        return timezone.make_aware(dt)

    raise ValueError(f"Invalid exam_time type: {type(exam_time)}")

@api_view(['GET'])
@permission_classes([AllowAny])
def proctor_assigned_exams(request, user_id):
    """
    Get all exams assigned to a specific proctor
    Categorized by: ongoing, upcoming, completed (history)
    """
    try:
        # Archive completed exams first (silent)
        try:
            archive_completed_attendances()
        except Exception:
            pass

        now = timezone.now()

        # Get all assigned exams
        exams = TblExamdetails.objects.filter(
            Q(proctor_id=user_id) | Q(proctors__contains=[user_id])
        ).select_related(
            'room',
            'room__building',
            'proctor',
            'modality',
            'modality__course'
        ).prefetch_related(
            'attendance_records'
        ).order_by('exam_date', 'exam_start_time')

        ongoing = []
        upcoming = []
        completed = []

        for exam in exams:
            try:
                if isinstance(exam.exam_start_time, datetime):
                    exam_start_datetime = (
                        timezone.make_aware(exam.exam_start_time)
                        if timezone.is_naive(exam.exam_start_time)
                        else exam.exam_start_time
                    )
                else:
                    exam_start_datetime = build_exam_datetime(
                        exam.exam_date, exam.exam_start_time
                    )

                if isinstance(exam.exam_end_time, datetime):
                    exam_end_datetime = (
                        timezone.make_aware(exam.exam_end_time)
                        if timezone.is_naive(exam.exam_end_time)
                        else exam.exam_end_time
                    )
                else:
                    exam_end_datetime = build_exam_datetime(
                        exam.exam_date, exam.exam_end_time
                    )
            except Exception:
                continue

            attendance = exam.attendance_records.filter(
                proctor_id=user_id
            ).first()

            if attendance:
                if attendance.is_substitute:
                    exam_status = 'substitute'
                else:
                    time_diff = (
                        (attendance.time_in - exam_start_datetime)
                        .total_seconds() / 60
                    )
                    exam_status = 'late' if time_diff > 7 else 'confirmed'
            else:
                exam_status = 'absent' if now > exam_end_datetime else 'pending'

            instructor_names = []
            if exam.instructors:
                for instructor_id in exam.instructors:
                    try:
                        instructor = TblUsers.objects.get(user_id=instructor_id)
                        instructor_names.append(
                            f"{instructor.first_name} {instructor.last_name}"
                        )
                    except TblUsers.DoesNotExist:
                        pass
            elif exam.instructor_id:
                try:
                    instructor = TblUsers.objects.get(user_id=exam.instructor_id)
                    instructor_names.append(
                        f"{instructor.first_name} {instructor.last_name}"
                    )
                except TblUsers.DoesNotExist:
                    pass

            instructor_name = ', '.join(instructor_names) if instructor_names else None
            sections_display = ', '.join(exam.sections) if exam.sections else exam.section_name

            exam_data = {
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
                'status': exam_status
            }

            if exam_start_datetime <= now <= exam_end_datetime:
                ongoing.append(exam_data)
            elif now < exam_start_datetime:
                upcoming.append(exam_data)
            else:
                completed.append(exam_data)

        history_records = TblProctorAttendanceHistory.objects.filter(
            proctor_id=user_id
        ).order_by('-exam_date', '-exam_start_time')

        for record in history_records:
            completed.append({
                'id': record.examdetails_id,
                'course_id': record.course_id,
                'subject': record.course_id,
                'section_name': record.section_name,
                'exam_date': record.exam_date,
                'exam_start_time': record.exam_start_time.isoformat() if record.exam_start_time else None,
                'exam_end_time': record.exam_end_time.isoformat() if record.exam_end_time else None,
                'building_name': record.building_name,
                'room_id': record.room_id,
                'instructor_name': record.instructor_name,
                'status': record.status
            })

        return Response({
            'ongoing': ongoing,
            'upcoming': upcoming,
            'completed': completed
        }, status=http_status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'error': str(e),
            'detail': 'Failed to fetch assigned exams'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
def archive_completed_attendances():
    """
    Move completed exam attendances to history table
    NOW INCLUDES SUBSTITUTION INFO
    """
    now = timezone.now()

    completed_attendances = TblProctorAttendance.objects.select_related(
        'examdetails',
        'examdetails__room',
        'proctor'
    ).filter(
        examdetails__exam_end_time__lt=now
    )

    archived_count = 0

    with transaction.atomic():
        for attendance in completed_attendances:
            exam = attendance.examdetails

            # Determine status
            if attendance.is_substitute:
                status = 'substitute'
            elif attendance.time_in:
                exam_start_datetime = build_exam_datetime(
                    exam.exam_date,
                    exam.exam_start_time
                )
                time_diff = (
                    (attendance.time_in - exam_start_datetime)
                    .total_seconds() / 60
                )
                status = 'late' if time_diff > 7 else 'confirmed'
            else:
                status = 'absent'

            # Get instructor name
            instructor_name = None
            if exam.instructors:
                instructor_names = []
                for instructor_id in exam.instructors:
                    try:
                        instructor = TblUsers.objects.get(user_id=instructor_id)
                        instructor_names.append(
                            f"{instructor.first_name} {instructor.last_name}"
                        )
                    except TblUsers.DoesNotExist:
                        pass
                instructor_name = ', '.join(instructor_names) if instructor_names else None
            elif exam.instructor_id:
                try:
                    instructor = TblUsers.objects.get(user_id=exam.instructor_id)
                    instructor_name = f"{instructor.first_name} {instructor.last_name}"
                except TblUsers.DoesNotExist:
                    pass

            # Substitution info
            substituted_for_id = None
            substituted_for_name = None

            if attendance.is_substitute:
                try:
                    substitution = TblProctorSubstitution.objects.filter(
                        examdetails=exam,
                        substitute_proctor_id=attendance.proctor_id
                    ).first()

                    if substitution and substitution.original_proctor:
                        substituted_for_id = substitution.original_proctor.user_id
                        substituted_for_name = (
                            f"{substitution.original_proctor.first_name} "
                            f"{substitution.original_proctor.last_name}"
                        )
                except Exception:
                    pass

            # Skip if already archived
            if TblProctorAttendanceHistory.objects.filter(
                attendance_id=attendance.attendance_id
            ).exists():
                continue

            # Create history record
            TblProctorAttendanceHistory.objects.create(
                attendance_id=attendance.attendance_id,
                examdetails_id=exam.examdetails_id,
                proctor_id=attendance.proctor_id,
                proctor_name=f"{attendance.proctor.first_name} {attendance.proctor.last_name}",
                course_id=exam.course_id,
                section_name=', '.join(exam.sections) if exam.sections else exam.section_name,
                exam_date=exam.exam_date,
                exam_start_time=exam.exam_start_time,
                exam_end_time=exam.exam_end_time,
                building_name=exam.building_name,
                room_id=exam.room.room_id if exam.room else None,
                instructor_name=instructor_name,
                is_substitute=attendance.is_substitute,
                remarks=attendance.remarks,
                substituted_for_id=substituted_for_id,
                substituted_for_name=substituted_for_name,
                time_in=attendance.time_in,
                time_out=attendance.time_out,
                otp_used=attendance.otp_used,
                status=status
            )

            archived_count += 1

        if archived_count > 0:
            completed_attendances.delete()

    return archived_count

# ============================================================
# ALL EXAMS FOR SUBSTITUTION
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def all_exams_for_substitution(request):
    """
    Get all upcoming exams for substitution
    Excludes user's own schedules and time conflicts
    """
    try:
        user_id = request.GET.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        user_id = int(user_id)
        today = timezone.now().date()
        
        # Get user's assigned exams to check conflicts
        user_exams = TblExamdetails.objects.filter(
            Q(proctor_id=user_id) | Q(proctors__contains=[user_id]),
            exam_date__gte=today.isoformat()
        ).values('exam_date', 'exam_start_time', 'exam_end_time')
        
        # Get all upcoming exams
        all_exams = TblExamdetails.objects.filter(
            exam_date__gte=today.isoformat()
        ).exclude(
            Q(proctor_id=user_id) | Q(proctors__contains=[user_id])
        ).select_related(
            'room',
            'room__building',
            'proctor',
            'modality'
        ).order_by('exam_date', 'exam_start_time')
        
        result = []
        for exam in all_exams:
            # Check time conflicts
            has_conflict = False
            for user_exam in user_exams:
                if exam.exam_date == user_exam['exam_date']:
                    # Same date, check time overlap
                    if (exam.exam_start_time < user_exam['exam_end_time'] and 
                        exam.exam_end_time > user_exam['exam_start_time']):
                        has_conflict = True
                        break
            
            if has_conflict:
                continue
            
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
            
            has_attendance = TblProctorAttendance.objects.filter(examdetails=exam).exists()
            exam_status = 'confirmed' if has_attendance else 'pending'
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
        
        return Response(result, status=http_status.HTTP_200_OK)
        
    except Exception as e:
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
    FIXED: Check history table first to preserve statuses
    """
    try:
        archive_completed_attendances()
        college_name = request.GET.get('college_name')
        exam_date = request.GET.get('exam_date')
        year = request.GET.get('year')
        month = request.GET.get('month')

        queryset = TblExamdetails.objects.select_related(
            'room',
            'room__building',
            'proctor',
            'modality'
        ).prefetch_related(
            'attendance_records',
            'attendance_records__proctor',
            'substitutions',
            'substitutions__substitute_proctor',
            'substitutions__original_proctor'
        )

        if college_name:
            queryset = queryset.filter(college_name=college_name)
        if exam_date:
            queryset = queryset.filter(exam_date=exam_date)

        queryset = queryset.order_by('exam_date', 'exam_start_time')
        result = []

        for exam in queryset:
            try:
                otp_record = TblExamOtp.objects.filter(examdetails=exam).first()
                otp_code = otp_record.otp_code if otp_record else None
            except Exception:
                otp_code = None

            assigned_proctor_ids = exam.proctors if exam.proctors else ([exam.proctor_id] if exam.proctor_id else [])
            proctor_statuses = []

            for proctor_id in assigned_proctor_ids:
                try:
                    proctor = TblUsers.objects.get(user_id=proctor_id)
                    proctor_name = f"{proctor.first_name} {proctor.last_name}"

                    history_record = TblProctorAttendanceHistory.objects.filter(
                        examdetails_id=exam.examdetails_id,
                        proctor_id=proctor_id
                    ).first()

                    if history_record:
                        proctor_statuses.append({
                            'proctor_id': proctor_id,
                            'proctor_name': proctor_name,
                            'status': history_record.status,
                            'time_in': history_record.time_in.isoformat() if history_record.time_in else None,
                            'is_assigned': not history_record.is_substitute,
                            'is_substitute': history_record.is_substitute,
                            'substituted_for': history_record.substituted_for_name,
                            'substitution_remarks': history_record.remarks if history_record.is_substitute else None
                        })
                        continue

                    attendance = exam.attendance_records.filter(proctor_id=proctor_id).first()
                    if attendance:
                        if attendance.is_substitute:
                            status = 'substitute'
                        else:
                            if exam.exam_start_time and exam.exam_date and attendance.time_in:
                                from datetime import datetime
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
                        substituted_for = None
                        if attendance.is_substitute:
                            assigned_ids = exam.proctors if exam.proctors else ([exam.proctor_id] if exam.proctor_id else [])
                            if assigned_ids:
                                original_proctor = TblUsers.objects.filter(user_id=assigned_ids[0]).first()
                                if original_proctor:
                                    substituted_for = f"{original_proctor.first_name} {original_proctor.last_name}"
                        proctor_statuses.append({
                            'proctor_id': proctor_id,
                            'proctor_name': proctor_name,
                            'status': status,
                            'time_in': time_in.isoformat() if time_in else None,
                            'is_assigned': True,
                            'is_substitute': attendance.is_substitute,
                            'substituted_for': substituted_for,
                            'substitution_remarks': attendance.remarks
                        })
                    else:
                        status = 'absent' if exam.exam_end_time and timezone.now() > exam.exam_end_time else 'pending'
                        proctor_statuses.append({
                            'proctor_id': proctor_id,
                            'proctor_name': proctor_name,
                            'status': status,
                            'time_in': None,
                            'is_assigned': True,
                            'is_substitute': False
                        })
                except TblUsers.DoesNotExist:
                    continue
                except Exception:
                    continue

            for attendance in exam.attendance_records.filter(is_substitute=True):
                if not any(p['proctor_id'] == attendance.proctor_id for p in proctor_statuses):
                    proctor_name = f"{attendance.proctor.first_name} {attendance.proctor.last_name}"
                    original_proctor_name = None
                    try:
                        substitution = TblProctorSubstitution.objects.filter(
                            examdetails=exam,
                            substitute_proctor_id=attendance.proctor_id
                        ).first()
                        if substitution and substitution.original_proctor:
                            original_proctor_name = f"{substitution.original_proctor.first_name} {substitution.original_proctor.last_name}"
                    except Exception:
                        pass
                    proctor_statuses.append({
                        'proctor_id': attendance.proctor_id,
                        'proctor_name': proctor_name,
                        'status': 'substitute',
                        'time_in': attendance.time_in.isoformat() if attendance.time_in else None,
                        'is_assigned': False,
                        'is_substitute': True,
                        'substituted_for': original_proctor_name,
                        'substitution_remarks': attendance.remarks
                    })

            if proctor_statuses:
                proctor_parts = []
                for p in proctor_statuses:
                    if p.get('is_substitute'):
                        status_icon = '🔄'
                        proctor_parts.append(f"{p['proctor_name']} ({status_icon} SUB for {p.get('substituted_for', 'N/A')})")
                    else:
                        status_icon = '✓' if p['status'] in ['confirmed', 'late'] else '✗'
                        proctor_parts.append(f"{p['proctor_name']} ({status_icon})")
                proctor_display = ', '.join(proctor_parts)
            else:
                proctor_display = 'No proctor assigned'

            has_any_attendance = any(p['status'] in ['confirmed', 'late', 'substitute'] for p in proctor_statuses)
            overall_status = 'confirmed' if has_any_attendance else 'pending'
            first_time_in = next((p['time_in'] for p in proctor_statuses if p['time_in']), None)

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
                'proctor_name': proctor_display,
                'proctor_details': proctor_statuses,
                'instructor_name': instructor_name,
                'department': exam.college_name,
                'college': exam.college_name,
                'examdetails_status': overall_status,
                'status': overall_status,
                'code_entry_time': first_time_in,
                'otp_code': otp_code
            })

        history_query = TblProctorAttendanceHistory.objects.all()
        is_viewing_history = False

        if year and year != 'all':
            is_viewing_history = True
            history_query = history_query.filter(exam_date__startswith=year)
        if month and month != 'all':
            is_viewing_history = True
            if year and year != 'all':
                history_query = history_query.filter(exam_date__startswith=f"{year}-{month.zfill(2)}")
            else:
                history_query = history_query.filter(exam_date__regex=rf'^\d{{4}}-{month.zfill(2)}-')

        if is_viewing_history:
            result = []

        for record in history_query:
            result.append({
                'id': record.examdetails_id,
                'course_id': record.course_id,
                'subject': record.course_id,
                'section_name': record.section_name,
                'exam_date': record.exam_date,
                'exam_start_time': record.exam_start_time.isoformat() if record.exam_start_time else None,
                'exam_end_time': record.exam_end_time.isoformat() if record.exam_end_time else None,
                'building_name': record.building_name,
                'room_id': record.room_id,
                'proctor_name': record.proctor_name,
                'proctor_details': [{
                    'proctor_id': record.proctor_id,
                    'proctor_name': record.proctor_name,
                    'status': record.status,
                    'time_in': record.time_in.isoformat() if record.time_in else None,
                    'is_assigned': not record.is_substitute,
                    'is_substitute': record.is_substitute,
                    'substituted_for': record.substituted_for_name,
                    'substitution_remarks': record.remarks if record.is_substitute else None
                }],
                'instructor_name': record.instructor_name,
                'department': '',
                'college': '',
                'examdetails_status': record.status,
                'status': record.status,
                'code_entry_time': record.time_in.isoformat() if record.time_in else None,
                'otp_code': record.otp_used,
                'approval_status': 'approved'
            })

        return Response(result, status=http_status.HTTP_200_OK)

    except Exception as e:
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
        serializer = TblAvailableRoomsSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'error': str(e),
                    'detail': 'Failed to save available room'
                }, status=status.HTTP_400_BAD_REQUEST)
        
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
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user_id = request.data.get("user_id")
    if not user_id:
        return Response({"error": "Missing user_id"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        scheduler_role = TblUserRole.objects.filter(user_id=user_id, role_id=3).first()
        if not scheduler_role:
            return Response(
                {"error": "User is not a scheduler or has no college"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        dean_role = TblUserRole.objects.filter(
            college_id=scheduler_role.college_id, 
            role_id=1
        ).first()
        
        if not dean_role:
            return Response(
                {"error": "No dean found for this college"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        dean_user = TblUsers.objects.filter(user_id=dean_role.user_id).first()
        if not dean_user:
            return Response(
                {"error": "Dean user record not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

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
            "submitted_by_id": user_id,  
        }

        TblScheduleapproval.objects.create(
            request_id=request_id,
            submitted_by_id=user_id, 
            dean_user_id=dean_role.user_id,
            college_name=serializer.validated_data["college_name"],
            schedule_data=schedule_data,
            remarks=serializer.validated_data.get("remarks", "No remarks"),
            status="pending",
            submitted_at=timezone.now(),
            created_at=timezone.now(),
        )

        TblNotification.objects.create(
            user_id=dean_role.user_id,
            sender_id=user_id,
            title="New Schedule Approval Request",
            message=f"Scheduler submitted a schedule for {serializer.validated_data['college_name']}.",
            type="schedule_approval",
            status="unread",
            link_url="/dean-requests",
            is_seen=False,
            priority=1,
            created_at=timezone.now(),
        )

        return Response(
            {
                "message": "Schedule successfully sent to Dean.",
                "request_id": str(request_id),
                "dean_name": f"{dean_user.first_name} {dean_user.last_name}",
                "dean_user_id": dean_user.user_id,
                "scheduler_user_id": user_id, 
                "total_schedules": len(serializer.validated_data["schedules"]),
                "college_name": serializer.validated_data["college_name"],
                "status": "pending"
            },
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
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
        approvals = TblScheduleapproval.objects.select_related('submitted_by').all().order_by('-created_at')
        
        status = request.GET.get('status')
        if status:
            approvals = approvals.filter(status=status)
        
        college_name = request.GET.get('college_name')
        if college_name:
            approvals = approvals.filter(college_name=college_name)
        
        limit = request.GET.get('limit')
        if limit:
            try:
                approvals = approvals[:int(limit)]
            except ValueError:
                pass
        
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
    PUT → Update (and notify proctors with their schedules if approved)
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
        old_status = approval.status
        serializer = TblScheduleapprovalSerializer(approval, data=request.data, partial=True)
        
        if serializer.is_valid():
            updated_approval = serializer.save()
            
            # If status changed to approved, notify all proctors with their schedules
            if old_status != 'approved' and updated_approval.status == 'approved':
                try:
                    # Get college name from approval
                    college_name = updated_approval.college_name
                    
                    # Get all exam schedules for this college
                    exams = TblExamdetails.objects.filter(
                        college_name=college_name
                    ).select_related('proctor', 'room', 'room__building').order_by('exam_date', 'exam_start_time')
                    
                    # Get dean name for notification
                    dean_name = "Dean"
                    dean_email = ""
                    if updated_approval.dean_user_id:
                        try:
                            dean = TblUsers.objects.get(user_id=updated_approval.dean_user_id)
                            dean_name = f"{dean.first_name} {dean.last_name}"
                            dean_email = dean.email_address or ""
                        except TblUsers.DoesNotExist:
                            pass
                    
                    # Group exams by proctor
                    proctor_schedules = {}
                    for exam in exams:
                        proctor_ids_list = []
                        
                        if exam.proctor_id:
                            proctor_ids_list.append(exam.proctor_id)
                        if exam.proctors:
                            proctor_ids_list.extend(exam.proctors)
                        
                        for proctor_id in proctor_ids_list:
                            if proctor_id not in proctor_schedules:
                                proctor_schedules[proctor_id] = []
                            proctor_schedules[proctor_id].append(exam)
                    
                    # Helper function to format time
                    def format_time_12hour(time_obj):
                        if isinstance(time_obj, str):
                            time_obj = datetime.fromisoformat(time_obj).time()
                        hour = time_obj.hour
                        minute = time_obj.minute
                        ampm = "PM" if hour >= 12 else "AM"
                        hour = hour % 12 or 12
                        return f"{hour}:{str(minute).zfill(2)} {ampm}"
                    
                    def format_date(date_str):
                        try:
                            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                            return date_obj.strftime('%B %d, %Y')
                        except:
                            return date_str
                    
                    # Create notifications for all proctors with their specific schedules
                    notifications_created = 0
                    for proctor_id, proctor_exams in proctor_schedules.items():
                        try:
                            # Get proctor details
                            proctor = TblUsers.objects.get(user_id=proctor_id)
                            proctor_name = f"{proctor.first_name} {proctor.last_name}"
                            
                            # Build detailed schedule message
                            notification_message = f"Dear {proctor.first_name} {proctor.last_name},\n\n"
                            notification_message += f"The exam schedule for {college_name} has been approved by {dean_name}.\n\n"
                            notification_message += f"You have been assigned as a proctor for the following examination schedule(s):\n\n"
                            
                            for index, exam in enumerate(proctor_exams, 1):
                                # Get section display
                                sections_display = ', '.join(exam.sections) if exam.sections else exam.section_name
                                
                                notification_message += f"{index}. {exam.course_id} - {sections_display}\n"
                                notification_message += f"   Date: {format_date(exam.exam_date)}\n"
                                
                                if exam.exam_start_time and exam.exam_end_time:
                                    start_time = format_time_12hour(exam.exam_start_time)
                                    end_time = format_time_12hour(exam.exam_end_time)
                                    notification_message += f"   Time: {start_time} - {end_time}\n"
                                
                                if exam.room and exam.building_name:
                                    notification_message += f"   Room: {exam.room.room_id}, {exam.building_name}\n"
                                
                                notification_message += "\n"
                            
                            notification_message += "Please ensure you arrive at least 15 minutes before the exam starts.\n\n"
                            notification_message += "If you have any conflicts or concerns, please contact your scheduler immediately.\n\n"
                            notification_message += f"Best regards,\n{dean_name}\n"
                            notification_message += f"Dean, {college_name}\n"
                            if dean_email:
                                notification_message += f"{dean_email}"
                            
                            # Create notification
                            TblNotification.objects.create(
                                user_id=proctor_id,
                                sender_id=updated_approval.dean_user_id,
                                title=f"Proctoring Assignment - {college_name}",
                                message=notification_message,
                                type='schedule_approval',
                                status='unread',
                                link_url='/proctor-schedule',
                                is_seen=False,
                                priority=2,
                                created_at=timezone.now()
                            )
                            notifications_created += 1
                            
                        except TblUsers.DoesNotExist:
                            continue
                        except Exception as e:
                            import traceback
                            traceback.print_exc()
                            continue
                    
                    # Also notify the scheduler who submitted it
                    if updated_approval.submitted_by_id:
                        try:
                            scheduler = TblUsers.objects.get(user_id=updated_approval.submitted_by_id)
                            scheduler_name = f"{scheduler.first_name} {scheduler.last_name}"
                            
                            scheduler_notification_message = (
                                f"Dear {scheduler.first_name} {scheduler.last_name},\n\n"
                                f"Your exam schedule for {college_name} has been approved by {dean_name}.\n\n"
                                f"All {notifications_created} assigned proctor(s) have been notified of their schedules with detailed exam information.\n\n"
                                f"The schedule is now active and visible to all proctors.\n\n"
                                f"Best regards,\n"
                                f"{dean_name}\n"
                                f"Dean, {college_name}"
                            )
                            
                            TblNotification.objects.create(
                                user_id=updated_approval.submitted_by_id,
                                sender_id=updated_approval.dean_user_id,
                                title=f"Schedule Approved - {college_name}",
                                message=scheduler_notification_message,
                                type='schedule_approval',
                                status='unread',
                                link_url='/scheduler-dashboard',
                                is_seen=False,
                                priority=1,
                                created_at=timezone.now()
                            )
                        except Exception:
                            pass
                    
                except Exception as e:
                    # Log error but don't fail the approval
                    import traceback
                    traceback.print_exc()
            
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

            # Filter by proctor_id (supports both single proctor and proctors array)
            proctor_id = request.GET.get('proctor_id')
            if proctor_id:
                try:
                    proctor_id_int = int(proctor_id)
                    queryset = queryset.filter(
                        Q(proctor_id=proctor_id_int) |
                        Q(proctors__overlap=[proctor_id_int])
                    )
                except ValueError:
                    pass  # silently ignore invalid proctor_id

            # Existing filters
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
            
            serializer = TblExamdetailsSerializer(queryset, many=True)
            return Response(serializer.data)
        
        except Exception as e:
            return Response(
                {'error': str(e), 'detail': 'Failed to fetch exam details'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    elif request.method == 'POST':
        many = isinstance(request.data, list)
        serializer = TblExamdetailsSerializer(data=request.data, many=many)
        if serializer.is_valid():
            try:
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response(
                    {'error': str(e), 'detail': 'Failed to save exam details'},
                    status=status.HTTP_400_BAD_REQUEST
                )
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

            course_id = request.GET.get('course_id')
            program_id = request.GET.get('program_id')
            section_name = request.GET.get('section_name')
            modality_type = request.GET.get('modality_type')
            room_type = request.GET.get('room_type')
            user_id = request.GET.get('user_id')  


            if user_id:
                queryset = queryset.filter(user__user_id=user_id)

            if course_id:
                course_ids = [cid.strip() for cid in course_id.split(',') if cid.strip()]
                queryset = queryset.filter(course_id__in=course_ids)
            
            if program_id:
                program_ids = [pid.strip() for pid in program_id.split(',') if pid.strip()]
                queryset = queryset.filter(program_id__in=program_ids)
            
            if section_name:
                queryset = queryset.filter(section_name=section_name)
            if modality_type:
                queryset = queryset.filter(modality_type=modality_type)
            if room_type:
                queryset = queryset.filter(room_type=room_type)
            
            serializer = TblModalitySerializer(queryset, many=True)
            return Response(serializer.data)
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': str(e), 'detail': 'Failed to fetch modalities'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'POST':        
        serializer = TblModalitySerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'error': str(e),
                    'detail': 'Failed to save modality'
                }, status=status.HTTP_400_BAD_REQUEST)
        
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
            deleted_count, _ = TblExamdetails.objects.filter(
                college_name=college_name
            ).delete()
            
            return Response({
                'message': f'Successfully deleted {deleted_count} schedules',
                'deleted_count': deleted_count
            }, status=status.HTTP_200_OK)
            
        elif exam_ids:
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
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([AllowAny])
def tbl_availability_list(request):
    if request.method == 'GET':
        user_id = request.GET.get('user_id')
        user_ids = request.GET.get('user_ids')  
        college_id = request.GET.get('college_id')
        status_param = request.GET.get('status')
        days = request.GET.getlist('days[]') or request.GET.getlist('days')

        availabilities = TblAvailability.objects.select_related('user').all()

        if user_id:
            availabilities = availabilities.filter(user__user_id=user_id)
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
    data['changed_at'] = timezone.now()  
    
    serializer = TblUserRoleHistorySerializer(data=data)
    if serializer.is_valid():
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
            try:
                user = serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'error': str(e),
                    'detail': 'Failed to create account'
                }, status=status.HTTP_400_BAD_REQUEST)
        
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
        courses = TblCourse.objects.select_related('term').prefetch_related('tblcourseusers_set__user').all()
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = CourseSerializer(data=request.data)
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    course = serializer.create(serializer.validated_data)
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
            except Exception:
                pass 

        Thread(target=send_email_async).start()

        return Response({
            'message': 'Password reset link will be sent to your email shortly!'
        }, status=status.HTTP_200_OK)

    except Exception:
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
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[proctor_email],
                    fail_silently=False,
                )
                
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
                
            except Exception as e:
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

    user.password = make_password(new_password)
    user.save()

    cache.delete(cache_key)

    return Response({"message": "Password changed successfully!"}, status=200)

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
        if user.status and user.status.lower() != 'active':
            return Response({'message': 'Account is not active'}, status=status.HTTP_401_UNAUTHORIZED)

        if not check_password(password, user.password):
            return Response({'message': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        token = secrets.token_hex(16)

        user_roles = TblUserRole.objects.filter(user=user, status__iexact='active')
        roles_data = UserRoleSerializer(user_roles, many=True).data

        return Response({
            'token': token,
            'user_id': user.user_id,
            'email': user.email_address,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'roles': roles_data
        }, status=status.HTTP_200_OK)

    except TblUsers.DoesNotExist:
        return Response({'message': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    except Exception as e:
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

    user.password = make_password(new_password)
    user.save()

    cache.delete(cache_key)

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
    
    avatar_file = request.FILES.get('avatar')
    if not avatar_file:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if avatar_file.content_type not in allowed_types:
        return Response({
            'error': 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if avatar_file.size > 5 * 1024 * 1024:
        return Response({
            'error': 'File too large. Maximum size is 5MB'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        
        img = Image.open(avatar_file)
        
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=85, optimize=True)
        buffer.seek(0)
        
        img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        avatar_url = f"data:image/jpeg;base64,{img_base64}"
        
        user.avatar_url = avatar_url
        user.save()
        
        return Response({
            'message': 'Avatar uploaded successfully',
            'avatar_url': avatar_url
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
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
        
        if not data.get('password'):
            last_name = data.get('last_name', '')
            user_id = data.get('user_id', '')
            data['password'] = f"{last_name}@{user_id}"
                
        serializer = TblUsersSerializer(data=data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
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
        college_identifier = item.get('college_name') 
        college_to_remove = item.get('college_to_remove')
        
        if not start_date:
            continue
        
        from django.utils import timezone
        from datetime import datetime
        
        try:
            date_obj = datetime.strptime(start_date, '%Y-%m-%d')
            date_obj = timezone.make_aware(date_obj)
        except ValueError:
            continue
        
        if college_to_remove:
            deleted = TblExamperiod.objects.filter(
                start_date=date_obj,
                college__college_id=college_to_remove
            ).delete()
            
            if deleted[0] == 0:
                deleted = TblExamperiod.objects.filter(
                    start_date=date_obj,
                    college__college_name=college_to_remove
                ).delete()
            
            updated_count += deleted[0]
            
        elif college_identifier:
            try:
                college_obj = TblCollege.objects.get(college_id=college_identifier)
            except TblCollege.DoesNotExist:
                try:
                    college_obj = TblCollege.objects.get(college_name=college_identifier)
                except TblCollege.DoesNotExist:
                    continue
            
            existing = TblExamperiod.objects.filter(
                start_date=date_obj,
                college=college_obj
            ).first()
            
            if not existing:
                template = TblExamperiod.objects.filter(start_date=date_obj).first()
                
                if template:
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
                    continue

    return Response({"updated_count": updated_count})

@api_view(['GET', 'POST', 'DELETE']) 
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
    
    elif request.method == 'DELETE': 
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
        serializer = UserSerializer(user) 
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
    
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if logo_file.content_type not in allowed_types:
        return Response({
            'error': 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        
        img = Image.open(logo_file)
        
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        
        buffer = BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        
        img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        logo_url = f"data:image/png;base64,{img_base64}"
        
        return Response({
            'message': 'Logo uploaded successfully',
            'logo_url': logo_url
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': 'Failed to process image',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)