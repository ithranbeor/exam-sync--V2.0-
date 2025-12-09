# exam-sync-v2/backend/api/serializers.py

from rest_framework import serializers
from django.utils import timezone
from .models import TblScheduleapproval, TblAvailableRooms, TblExamOtp, TblProctorAttendance, TblProctorSubstitution, TblNotification, TblUsers, TblRoles, TblExamdetails, TblAvailability, TblModality, TblSectioncourse, TblBuildings, TblUserRoleHistory, TblRooms, TblUserRole, TblCourseUsers, TblCourse, TblProgram, TblExamperiod, TblUserRole, TblTerm, TblCollege, TblDepartment
from django.contrib.auth.hashers import make_password

class CourseSerializer(serializers.Serializer):
    # This is a custom serializer (not ModelSerializer) because the db layout uses a join table.
    course_id = serializers.CharField()
    course_name = serializers.CharField()
    term_id = serializers.IntegerField()
    term_name = serializers.CharField(read_only=True)
    user_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    leaders = serializers.ListField(child=serializers.IntegerField(), required=False)
    instructor_names = serializers.ListField(child=serializers.CharField(), read_only=True)

    def to_representation(self, instance: TblCourse):
        """
        instance is TblCourse model instance. Build representation expected by frontend.
        """
        term = instance.term
        # find all TblCourseUsers entries for this course
        course_users = instance.tblcourseusers_set.select_related('user').all()
        user_ids = [cu.user.user_id for cu in course_users]
        instructor_names = [f"{cu.user.first_name} {cu.user.last_name}" for cu in course_users]
        leaders = [cu.user.user_id for cu in course_users if cu.is_bayanihan_leader]

        return {
            'course_id': instance.course_id,
            'course_name': instance.course_name,
            'term_id': term.term_id if term else None,
            'term_name': term.term_name if term else None,
            'user_ids': user_ids,
            'leaders': leaders,
            'instructor_names': instructor_names,
        }

    def create(self, validated_data):
        """
        Create TblCourse and associated TblCourseUsers rows.
        """
        course_id = validated_data['course_id']
        course_name = validated_data['course_name']
        term_id = validated_data['term_id']
        user_ids = validated_data.get('user_ids', [])
        leaders = validated_data.get('leaders', [])

        # create or update TblCourse
        term = TblTerm.objects.get(pk=term_id)
        course, created = TblCourse.objects.get_or_create(course_id=course_id, defaults={
            'course_name': course_name,
            'term': term
        })
        if not created:
            course.course_name = course_name
            course.term = term
            course.save()

        # sync TblCourseUsers: remove all for this course then add current
        TblCourseUsers.objects.filter(course=course).delete()

        for uid in user_ids:
            user = TblUsers.objects.get(pk=uid)
            is_leader = uid in leaders
            TblCourseUsers.objects.create(course=course, user=user, course_name=course_name, is_bayanihan_leader=is_leader)

        return course

    def update(self, instance: TblCourse, validated_data):
        """
        Update TblCourse + TblCourseUsers.
        """
        course_name = validated_data.get('course_name', instance.course_name)
        term_id = validated_data.get('term_id', instance.term.term_id if instance.term else None)
        user_ids = validated_data.get('user_ids', [])
        leaders = validated_data.get('leaders', [])

        if term_id is not None:
            term = TblTerm.objects.get(pk=term_id)
            instance.term = term
        instance.course_name = course_name
        instance.save()

        # sync course users
        TblCourseUsers.objects.filter(course=instance).delete()
        for uid in user_ids:
            user = TblUsers.objects.get(pk=uid)
            is_leader = uid in leaders
            TblCourseUsers.objects.create(course=instance, user=user, course_name=course_name, is_bayanihan_leader=is_leader)

        return instance
    
class TblProgramSerializer(serializers.ModelSerializer):
    department = serializers.SerializerMethodField()
    department_id = serializers.CharField()

    class Meta:
        model = TblProgram
        fields = ['program_id', 'program_name', 'department', 'department_id']

    def get_department(self, obj):
        return obj.department.department_name if obj.department else "N/A"

    def create(self, validated_data):
        dept_id = validated_data.pop('department_id')
        department = TblDepartment.objects.get(pk=dept_id)
        return TblProgram.objects.create(department=department, **validated_data)

    def update(self, instance, validated_data):
        dept_id = validated_data.pop('department_id', None)
        if dept_id:
            instance.department = TblDepartment.objects.get(pk=dept_id)
        instance.program_name = validated_data.get('program_name', instance.program_name)
        instance.save()
        return instance
    
class TblCollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblCollege
        fields = ['college_id', 'college_name']
        extra_kwargs = {
            'college_id': {'validators': []},  # disable uniqueness check on update
        }

class TblDepartmentSerializer(serializers.ModelSerializer):
    college = TblCollegeSerializer(read_only=True)
    college_id = serializers.CharField()

    class Meta:
        model = TblDepartment
        fields = ['department_id', 'department_name', 'college', 'college_id']

    def create(self, validated_data):
        college_id = validated_data.pop('college_id')
        college = TblCollege.objects.get(pk=college_id)
        return TblDepartment.objects.create(college=college, **validated_data)

    def update(self, instance, validated_data):
        college_id = validated_data.pop('college_id', None)
        if college_id:
            instance.college = TblCollege.objects.get(pk=college_id)
        instance.department_name = validated_data.get('department_name', instance.department_name)
        instance.save()
        return instance

class UserRoleSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.role_name')

    class Meta:
        model = TblUserRole
        fields = ['user_role_id', 'role_name', 'status', 'college', 'department']

class TblExamperiodSerializer(serializers.ModelSerializer):
    term_id = serializers.IntegerField(source='term.term_id', read_only=True)
    term_name = serializers.CharField(source='term.term_name', read_only=True)

    department_id = serializers.CharField(source='department.department_id', read_only=True)
    department_name = serializers.CharField(source='department.department_name', read_only=True)

    college_id = serializers.CharField(source='college.college_id', read_only=True)
    college_name = serializers.CharField(source='college.college_name', read_only=True)

    class Meta:
        model = TblExamperiod
        fields = [
            'examperiod_id',
            'start_date',
            'end_date',
            'academic_year',
            'exam_category',
            'term', 'term_id', 'term_name',
            'department', 'department_id', 'department_name',
            'college', 'college_id', 'college_name'
        ]

class TblUserRoleSerializer(serializers.ModelSerializer):
    # Input fields (for POST/PUT)
    user = serializers.PrimaryKeyRelatedField(queryset=TblUsers.objects.all())
    role = serializers.PrimaryKeyRelatedField(queryset=TblRoles.objects.all())
    college = serializers.PrimaryKeyRelatedField(
        queryset=TblCollege.objects.all(),
        allow_null=True,
        required=False
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=TblDepartment.objects.all(),
        allow_null=True,
        required=False
    )

    # Read-only fields with IDs
    user_id = serializers.IntegerField(source='user.user_id', read_only=True)
    role_id = serializers.IntegerField(source='role.role_id', read_only=True)
    college_id = serializers.CharField(source='college.college_id', read_only=True, allow_null=True)
    department_id = serializers.CharField(source='department.department_id', read_only=True, allow_null=True)

    # ✅ ADD THESE EXPANDED FIELDS
    college_object = serializers.SerializerMethodField(read_only=True)
    
    # Display fields
    role_name = serializers.CharField(source='role.role_name', read_only=True)
    college_name = serializers.CharField(source='college.college_name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.department_name', read_only=True, allow_null=True)
    user_full_name = serializers.SerializerMethodField()

    class Meta:
        model = TblUserRole
        fields = [
            'user_role_id',
            'user',
            'user_id',
            'user_full_name',
            'role',
            'role_id',
            'role_name',
            'college',
            'college_id',
            'college_name',
            'college_object',  # ✅ ADD THIS
            'department',
            'department_id',
            'department_name',
            'status',
            'created_at',
            'date_start',
            'date_ended',
        ]

    def get_user_full_name(self, obj):
        """Return user's full name if available"""
        return f"{obj.user.first_name} {obj.user.last_name}"
    
    def get_college_object(self, obj):
        """✅ Return full college object with all fields"""
        if obj.college:
            return {
                'college_id': obj.college.college_id,
                'college_name': obj.college.college_name
            }
        return None

    def create(self, validated_data):
        """Automatically set created_at when creating"""
        if not validated_data.get("created_at"):
            validated_data["created_at"] = timezone.now()
        return super().create(validated_data)

class TblTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblTerm
        fields = '__all__'

    def validate_term_name(self, value):
        if not value or value.strip() == "":
            raise serializers.ValidationError("Term name cannot be empty.")
        return value
    
class TblBuildingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblBuildings
        fields = '__all__'

class TblRoomsSerializer(serializers.ModelSerializer):
    # Extra display fields for related building info
    building_id = serializers.CharField(source='building.building_id', read_only=True)
    building_name = serializers.CharField(source='building.building_name', read_only=True)

    class Meta:
        model = TblRooms
        fields = [
            'room_id',
            'room_name',
            'room_type',
            'room_capacity',
            'building',        # used for POST/PUT (expects building_id value)
            'building_id',     # read-only helper
            'building_name',   # read-only helper
        ]

class TblUsersSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user_id', read_only=True)
    full_name = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = TblUsers
        fields = [
            'id',
            'user_id',
            'first_name',
            'last_name',
            'middle_name',
            'email_address',
            'contact_number',
            'status',
            'created_at',
            'avatar_url',
            'full_name',
            'password',
            'employment_type',  # ✅ NEW FIELD
        ]

    def get_full_name(self, obj):
        middle = f" {obj.middle_name[0]}." if obj.middle_name else ""
        return f"{obj.first_name}{middle} {obj.last_name}".strip()
    
    def create(self, validated_data):
        # Extract password if provided
        password = validated_data.pop('password', None)
        
        # If no password provided, generate default: LastName@user_id
        if not password:
            password = f"{validated_data['last_name']}@{validated_data['user_id']}"
        
        # Hash the password
        validated_data['password'] = make_password(password)
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # If password is being updated, hash it
        password = validated_data.pop('password', None)
        if password:
            instance.password = make_password(password)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


# Also update the basic UserSerializer if it's used elsewhere
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblUsers
        fields = [
            'user_id', 
            'first_name', 
            'middle_name', 
            'last_name',
            'email_address', 
            'contact_number', 
            'avatar_url', 
            'status', 
            'user_uuid',
            'employment_type',
        ]

class TblRolesSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblRoles
        fields = '__all__'

class TblUserRoleHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TblUserRoleHistory
        fields = [
            'history_id',
            'user_role_id',
            'user_id',
            'role_id',
            'college_id',
            'department_id',
            'date_start',
            'date_ended',
            'status',
            'action',
            'changed_at'
        ]
        read_only_fields = fields

class TblSectioncourseSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    program = TblProgramSerializer(read_only=True)
    term = TblTermSerializer(read_only=True)
    user = TblUsersSerializer(read_only=True)

    # ✅ CHANGED: removed write_only=True from all IDs
    course_id = serializers.CharField()
    program_id = serializers.CharField()
    term_id = serializers.IntegerField()
    user_id = serializers.IntegerField(required=False, allow_null=True)
    is_night_class = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = TblSectioncourse
        fields = [
            'id',
            'course', 'program', 'term', 'user',
            'course_id', 'program_id', 'term_id', 'user_id',
            'section_name', 'number_of_students', 'year_level',
            'is_night_class',
        ]

    def to_representation(self, instance):
        """Ensure all IDs are included"""
        representation = super().to_representation(instance)
        representation['course_id'] = instance.course.course_id if instance.course else None
        representation['program_id'] = instance.program.program_id if instance.program else None
        representation['term_id'] = instance.term.term_id if instance.term else None
        representation['user_id'] = instance.user.user_id if instance.user else None
        return representation

    def create(self, validated_data):
        course_id = validated_data.pop('course_id')
        program_id = validated_data.pop('program_id')
        term_id = validated_data.pop('term_id')
        user_id = validated_data.pop('user_id', None)

        course = TblCourse.objects.get(course_id=course_id)
        program = TblProgram.objects.get(program_id=program_id)
        term = TblTerm.objects.get(term_id=term_id)
        user = TblUsers.objects.get(user_id=user_id) if user_id else None

        return TblSectioncourse.objects.create(
            course=course, program=program, term=term, user=user, **validated_data
        )

    def update(self, instance, validated_data):
        course_id = validated_data.pop('course_id', None)
        program_id = validated_data.pop('program_id', None)
        term_id = validated_data.pop('term_id', None)
        user_id = validated_data.pop('user_id', None)

        if course_id:
            instance.course = TblCourse.objects.get(course_id=course_id)
        if program_id:
            instance.program = TblProgram.objects.get(program_id=program_id)
        if term_id:
            instance.term = TblTerm.objects.get(term_id=term_id)
        if user_id:
            instance.user = TblUsers.objects.get(user_id=user_id)

        if 'is_night_class' in validated_data:
            instance.is_night_class = validated_data.pop('is_night_class', '')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class TblCourseUsersSerializer(serializers.ModelSerializer):
    # Nested serializers for display
    course = CourseSerializer(read_only=True)
    tbl_users = TblUsersSerializer(source='user', read_only=True)

    # Writable foreign keys
    course_id = serializers.CharField(source='course.course_id', write_only=True)
    user_id = serializers.IntegerField(source='user.user_id', write_only=True)

    class Meta:
        model = TblCourseUsers
        fields = [
            'course',
            'tbl_users',
            'course_id',
            'user_id',
            'course_name',
            'is_bayanihan_leader'
        ]

    def create(self, validated_data):
        course_data = validated_data.pop('course')
        user_data = validated_data.pop('user')
        course = TblCourse.objects.get(course_id=course_data['course_id'])
        user = TblUsers.objects.get(user_id=user_data['user_id'])
        return TblCourseUsers.objects.create(course=course, user=user, **validated_data)

    def update(self, instance, validated_data):
        course_data = validated_data.pop('course', None)
        user_data = validated_data.pop('user', None)

        if course_data:
            instance.course = TblCourse.objects.get(course_id=course_data['course_id'])
        if user_data:
            instance.user = TblUsers.objects.get(user_id=user_data['user_id'])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class TblAvailabilitySerializer(serializers.ModelSerializer):
    user = TblUsersSerializer(read_only=True)
    user_id = serializers.IntegerField()  # ✅ Changed: removed write_only=True

    class Meta:
        model = TblAvailability
        fields = [
            'availability_id',
            'days',
            'time_slots',
            'status',
            'remarks',
            'user',
            'user_id',  # ✅ Now available for both read and write
        ]

    def create(self, validated_data):
        user_id = validated_data.pop('user_id')
        user = TblUsers.objects.get(user_id=user_id)
        return TblAvailability.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        user_id = validated_data.pop('user_id', None)
        if user_id:
            instance.user = TblUsers.objects.get(user_id=user_id)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class TblModalitySerializer(serializers.ModelSerializer):
    room = TblRoomsSerializer(read_only=True)
    user = TblUsersSerializer(read_only=True)
    course = CourseSerializer(read_only=True)
    
    room_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    user_id = serializers.IntegerField()
    course_id = serializers.CharField()
    
    # ✅ NEW: Support array of sections
    sections = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        allow_null=True
    )
    
    # ✅ NEW: Total students field
    total_students = serializers.IntegerField(required=False, default=0)
    
    possible_rooms = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        allow_null=True
    )

    class Meta:
        model = TblModality
        fields = [
            'modality_id',
            'modality_type',
            'room_type',
            'modality_remarks',
            'course',
            'course_id',
            'program_id',
            'room',
            'room_id',
            'user',
            'user_id',
            'created_at',
            'sections',
            'total_students',
            'possible_rooms',
        ]
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['course_id'] = instance.course.course_id if instance.course else None
        representation['user_id'] = instance.user.user_id if instance.user else None
        representation['room_id'] = instance.room.room_id if instance.room else None
        representation['program_id'] = instance.program_id
        representation['sections'] = instance.sections or []
        representation['total_students'] = instance.total_students or 0
        return representation
    
    def create(self, validated_data):
        # Extract write-only fields
        course_id = validated_data.pop('course_id', None)
        user_id = validated_data.pop('user_id', None)
        room_id = validated_data.pop('room_id', None)
        
        course = TblCourse.objects.get(course_id=course_id)
        user = TblUsers.objects.get(user_id=user_id)
        room = TblRooms.objects.get(room_id=room_id) if room_id else None
        
        instance = TblModality.objects.create(
            course=course,
            user=user,
            room=room,
            **validated_data
        )
        return instance
    
    def update(self, instance, validated_data):
        course_id = validated_data.pop('course_id', None)
        user_id = validated_data.pop('user_id', None)
        room_id = validated_data.pop('room_id', None)
        
        if course_id:
            instance.course = TblCourse.objects.get(course_id=course_id)
        if user_id:
            instance.user = TblUsers.objects.get(user_id=user_id)
        if room_id:
            instance.room = TblRooms.objects.get(room_id=room_id)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class TblExamdetailsSerializer(serializers.ModelSerializer):
    room = TblRoomsSerializer(read_only=True, allow_null=True)
    modality = TblModalitySerializer(read_only=True, allow_null=True)
    proctor = TblUsersSerializer(read_only=True, allow_null=True)
    examperiod = serializers.SerializerMethodField()

    room_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    modality_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    proctor_id = serializers.IntegerField(required=False, allow_null=True)
    examperiod_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    examdetails_status = serializers.SerializerMethodField()

    
    # ✅ NEW: Support arrays
    sections = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        allow_null=True
    )
    
    instructors = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        allow_null=True
    )
    
    proctors = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        allow_null=True
    )
    
    def get_examperiod(self, obj):
        if obj.examperiod:
            return {
                'examperiod_id': obj.examperiod.examperiod_id,
                'start_date': obj.examperiod.start_date,
                'end_date': obj.examperiod.end_date,
                'academic_year': obj.examperiod.academic_year,
                'exam_category': obj.examperiod.exam_category,
            }
        return None
    
    def get_examdetails_status(self, obj):
        """
        Determine proctor attendance status based on TblProctorAttendance.
        """

        attendance = obj.attendance_records.first()  # because of unique_together

        # No attendance record
        if not attendance:
            # Exam already finished → mark absent/late
            if obj.exam_end_time and timezone.now() > obj.exam_end_time:
                return "late"  # or "absent" depending on your rule
            return "pending"

        # Substitute proctor
        if attendance.is_substitute:
            return "substitute"

        # OTP used = present
        if attendance.otp_used and attendance.time_in:
            return "present"

        # Has record but no OTP = late
        return "late"
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['room_id'] = instance.room.room_id if instance.room else None
        representation['sections'] = instance.sections or []
        representation['instructors'] = instance.instructors or []
        representation['proctors'] = instance.proctors or []
        return representation

    class Meta:
        model = TblExamdetails
        fields = [
            'examdetails_id',
            'course_id',
            'program_id',
            'room',
            'room_id',
            'modality',
            'modality_id',
            'proctor',
            'proctor_id',
            'examperiod',
            'examperiod_id',
            'exam_duration',
            'exam_start_time',
            'exam_end_time',
            'proctor_timein',
            'proctor_timeout',
            'sections',
            'instructors',
            'proctors',
            'section_name',
            'instructor_id',
            'academic_year',
            'semester',
            'exam_category',
            'exam_period',
            'exam_date',
            'college_name',
            'building_name',
            'examdetails_status',

        ]

    def create(self, validated_data):
        room_id = validated_data.pop('room_id', None)
        modality_id = validated_data.pop('modality_id', None)
        proctor_id = validated_data.pop('proctor_id', None)
        examperiod_id = validated_data.pop('examperiod_id', None)

        if room_id:
            validated_data['room'] = TblRooms.objects.get(room_id=room_id)
        if modality_id:
            validated_data['modality'] = TblModality.objects.get(modality_id=modality_id)
        if proctor_id:
            validated_data['proctor'] = TblUsers.objects.get(user_id=proctor_id)
        if examperiod_id:
            validated_data['examperiod'] = TblExamperiod.objects.get(examperiod_id=examperiod_id)

        return super().create(validated_data)

    def update(self, instance, validated_data):
        room_id = validated_data.pop('room_id', None)
        modality_id = validated_data.pop('modality_id', None)
        proctor_id = validated_data.pop('proctor_id', None)
        examperiod_id = validated_data.pop('examperiod_id', None)

        if room_id is not None:
            instance.room = TblRooms.objects.get(room_id=room_id)
        if modality_id is not None:
            instance.modality = TblModality.objects.get(modality_id=modality_id)
        if proctor_id is not None:
            instance.proctor = TblUsers.objects.get(user_id=proctor_id) if proctor_id else None
        if examperiod_id is not None:
            instance.examperiod = TblExamperiod.objects.get(examperiod_id=examperiod_id)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance
    
class TblScheduleapprovalSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TblScheduleapproval
        fields = [
            'request_id',
            'dean_user_id',
            'submitted_at',
            'status',
            'remarks',
            'created_at',
            'submitted_by',
            'submitted_by_name',
            'schedule_data',
            'college_name',
        ]

    def get_submitted_by_name(self, obj):
        """Return full name if submitted_by is related to TblUsers"""
        if obj.submitted_by:
            return f"{obj.submitted_by.first_name} {obj.submitted_by.last_name}"
        return None
    
class ScheduleSendSerializer(serializers.Serializer):
    college_name = serializers.CharField()
    exam_period = serializers.CharField()
    term = serializers.CharField()
    semester = serializers.CharField()
    academic_year = serializers.CharField()
    building = serializers.CharField()
    remarks = serializers.CharField(allow_blank=True, required=False)
    schedules = serializers.ListField()

class TblNotificationSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(write_only=True)
    sender_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    user_full_name = serializers.SerializerMethodField(read_only=True)
    sender_full_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TblNotification
        fields = [
            'notification_id',
            'user',
            'user_id',
            'user_full_name',
            'sender',
            'sender_id',
            'sender_full_name',
            'title',
            'message',
            'type',
            'status',
            'link_url',
            'is_seen',
            'created_at',
            'read_at',
            'priority'
        ]
        read_only_fields = ['notification_id', 'created_at', 'read_at', 'user', 'sender']

    def get_user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else None

    def get_sender_full_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}" if obj.sender else 'System'

    def create(self, validated_data):
        user_id = validated_data.pop('user_id')
        sender_id = validated_data.pop('sender_id', None)
        user = TblUsers.objects.get(user_id=user_id)
        sender = TblUsers.objects.get(user_id=sender_id) if sender_id else None
        notification = TblNotification.objects.create(user=user, sender=sender, **validated_data)
        return notification

    def update(self, instance, validated_data):
        # Mark as read if is_seen is updated
        if validated_data.get('is_seen') and not instance.read_at:
            validated_data['read_at'] = timezone.now()
        sender_id = validated_data.pop('sender_id', None)
        if sender_id:
            instance.sender = TblUsers.objects.get(user_id=sender_id)
        return super().update(instance, validated_data)
    
class EmailNotificationSerializer(serializers.ModelSerializer):
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True
    )
    subject = serializers.CharField(write_only=True)
    body = serializers.CharField(write_only=True)

    class Meta:
        model = TblNotification
        fields = [
            'user_ids',
            'subject',
            'body',
            'type',
            'priority',
        ]
        extra_kwargs = {
            'type': {'default': 'email'},
            'priority': {'default': 1},
        }

    def create(self, validated_data):
        notifications = []
        for uid in validated_data['user_ids']:
            notifications.append(TblNotification(
                user_id=uid,
                title=validated_data['subject'],
                message=validated_data['body'],
                type=validated_data.get('type', 'email'),
                status='unread',
                is_seen=False,
                priority=validated_data.get('priority', 1),
                created_at=timezone.now()
            ))
        return TblNotification.objects.bulk_create(notifications)

class TblAvailableRoomsSerializer(serializers.ModelSerializer):
    room = TblRoomsSerializer(read_only=True)
    college = TblCollegeSerializer(read_only=True)
    
    # Remove write_only=True so these are included in GET responses
    room_id = serializers.CharField()
    college_id = serializers.CharField()
    
    class Meta:
        model = TblAvailableRooms
        fields = ['room_id', 'college_id', 'room', 'college', 'created_at']
    
    def to_representation(self, instance):
        """
        Ensure room_id and college_id are always included in the response
        """
        representation = super().to_representation(instance)
        # Explicitly add the IDs from the instance
        representation['room_id'] = instance.room_id
        representation['college_id'] = instance.college_id
        return representation
    
    def validate(self, attrs):
        """
        Validate that room and college exist before creating
        """
        room_id = attrs.get('room_id')
        college_id = attrs.get('college_id')
        
        # Check if room exists
        try:
            TblRooms.objects.get(room_id=room_id)
        except TblRooms.DoesNotExist:
            raise serializers.ValidationError({
                'room_id': f'Room with id {room_id} does not exist'
            })
        
        # Check if college exists
        try:
            TblCollege.objects.get(college_id=college_id)
        except TblCollege.DoesNotExist:
            raise serializers.ValidationError({
                'college_id': f'College with id {college_id} does not exist'
            })
        
        # Check if this combination already exists
        if TblAvailableRooms.objects.filter(room_id=room_id, college_id=college_id).exists():
            raise serializers.ValidationError({
                'non_field_errors': f'Room {room_id} is already available for college {college_id}'
            })
        
        return attrs
    
    def create(self, validated_data):
        room_id = validated_data.get('room_id')
        college_id = validated_data.get('college_id')
        
        return TblAvailableRooms.objects.create(
            room_id=room_id,
            college_id=college_id,
        )
    
class TblExamOtpSerializer(serializers.ModelSerializer):
    """Serializer for Exam OTP records"""
    
    course_id = serializers.CharField(source='examdetails.course_id', read_only=True)
    section_name = serializers.CharField(source='examdetails.section_name', read_only=True)
    exam_date = serializers.CharField(source='examdetails.exam_date', read_only=True)
    exam_start_time = serializers.DateTimeField(source='examdetails.exam_start_time', read_only=True)
    building_name = serializers.CharField(source='examdetails.building_name', read_only=True)
    room_id = serializers.CharField(source='examdetails.room.room_id', read_only=True)
    
    examdetails_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = TblExamOtp
        fields = [
            'otp_id',
            'examdetails',
            'examdetails_id',
            'otp_code',
            'created_at',
            'expires_at',
            'course_id',
            'section_name',
            'exam_date',
            'exam_start_time',
            'building_name',
            'room_id'
        ]
        read_only_fields = ['otp_id', 'created_at']
    
    def create(self, validated_data):
        examdetails_id = validated_data.pop('examdetails_id', None)
        if examdetails_id:
            from .models import TblExamdetails
            validated_data['examdetails'] = TblExamdetails.objects.get(pk=examdetails_id)
        return super().create(validated_data)


class TblProctorAttendanceSerializer(serializers.ModelSerializer):
    """Serializer for Proctor Attendance records"""
    
    proctor_name = serializers.SerializerMethodField()
    course_id = serializers.CharField(source='examdetails.course_id', read_only=True)
    section_name = serializers.CharField(source='examdetails.section_name', read_only=True)
    exam_date = serializers.CharField(source='examdetails.exam_date', read_only=True)
    room_id = serializers.CharField(source='examdetails.room.room_id', read_only=True)
    
    examdetails_id = serializers.IntegerField(write_only=True, required=False)
    proctor_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = TblProctorAttendance
        fields = [
            'attendance_id',
            'examdetails',
            'examdetails_id',
            'proctor',
            'proctor_id',
            'proctor_name',
            'is_substitute',
            'remarks',
            'time_in',
            'time_out',
            'otp_used',
            'course_id',
            'section_name',
            'exam_date',
            'room_id'
        ]
        read_only_fields = ['attendance_id', 'time_in']
    
    def get_proctor_name(self, obj):
        """Return proctor's full name"""
        return f"{obj.proctor.first_name} {obj.proctor.last_name}"
    
    def create(self, validated_data):
        examdetails_id = validated_data.pop('examdetails_id', None)
        proctor_id = validated_data.pop('proctor_id', None)
        
        if examdetails_id:
            from .models import TblExamdetails
            validated_data['examdetails'] = TblExamdetails.objects.get(pk=examdetails_id)
        
        if proctor_id:
            from .models import TblUsers
            validated_data['proctor'] = TblUsers.objects.get(user_id=proctor_id)
        
        return super().create(validated_data)


class TblProctorSubstitutionSerializer(serializers.ModelSerializer):
    """Serializer for Proctor Substitution records"""
    
    # Include names for display
    original_proctor_name = serializers.SerializerMethodField()
    substitute_proctor_name = serializers.SerializerMethodField()
    course_id = serializers.CharField(source='examdetails.course_id', read_only=True)
    exam_date = serializers.CharField(source='examdetails.exam_date', read_only=True)
    
    # Write-only fields for creating substitution
    examdetails_id = serializers.IntegerField(write_only=True, required=False)
    original_proctor_id = serializers.IntegerField(write_only=True, required=False)
    substitute_proctor_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = TblProctorSubstitution
        fields = [
            'substitution_id',
            'examdetails',
            'examdetails_id',
            'original_proctor',
            'original_proctor_id',
            'original_proctor_name',
            'substitute_proctor',
            'substitute_proctor_id',
            'substitute_proctor_name',
            'justification',
            'created_at',
            # Related fields
            'course_id',
            'exam_date'
        ]
        read_only_fields = ['substitution_id', 'created_at']
    
    def get_original_proctor_name(self, obj):
        """Return original proctor's full name"""
        return f"{obj.original_proctor.first_name} {obj.original_proctor.last_name}"
    
    def get_substitute_proctor_name(self, obj):
        """Return substitute proctor's full name"""
        return f"{obj.substitute_proctor.first_name} {obj.substitute_proctor.last_name}"
    
    def create(self, validated_data):
        examdetails_id = validated_data.pop('examdetails_id', None)
        original_proctor_id = validated_data.pop('original_proctor_id', None)
        substitute_proctor_id = validated_data.pop('substitute_proctor_id', None)
        
        if examdetails_id:
            from .models import TblExamdetails
            validated_data['examdetails'] = TblExamdetails.objects.get(pk=examdetails_id)
        
        if original_proctor_id:
            from .models import TblUsers
            validated_data['original_proctor'] = TblUsers.objects.get(user_id=original_proctor_id)
        
        if substitute_proctor_id:
            from .models import TblUsers
            validated_data['substitute_proctor'] = TblUsers.objects.get(user_id=substitute_proctor_id)
        
        return super().create(validated_data)