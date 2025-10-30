from rest_framework import serializers
from django.utils import timezone
from .models import TblUsers, TblRoles, TblExamdetails, TblAvailability, TblModality, TblSectioncourse, TblBuildings, TblUserRoleHistory, TblRooms, TblUserRole, TblCourseUsers, TblCourse, TblProgram, TblExamperiod, TblUserRole, TblInbox, TblTerm, TblCollege, TblDepartment

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
        course_users = TblCourseUsers.objects.filter(course=instance)
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
    department = serializers.StringRelatedField(read_only=True)
    department_id = serializers.CharField(write_only=True)

    class Meta:
        model = TblProgram
        fields = ['program_id', 'program_name', 'department', 'department_id']

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
    college_id = serializers.CharField(write_only=True)

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
    
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblUsers
        fields = [
            'user_id', 'first_name', 'middle_name', 'last_name',
            'email_address', 'contact_number', 'avatar_url', 'status', 'user_uuid'
        ]

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

    # Display (read-only) fields
    role_name = serializers.CharField(source='role.role_name', read_only=True)
    college_name = serializers.CharField(source='college.college_name', read_only=True)
    department_name = serializers.CharField(source='department.department_name', read_only=True)
    user_full_name = serializers.SerializerMethodField()

    class Meta:
        model = TblUserRole
        fields = [
            'user_role_id',
            'user',
            'user_full_name',
            'role',
            'role_name',
            'college',
            'college_name',
            'department',
            'department_name',
            'status',
            'created_at',
            'date_start',
            'date_ended',
        ]

    def get_user_full_name(self, obj):
        """Return user's full name if available"""
        return f"{obj.user.first_name} {obj.user.last_name}"

    def create(self, validated_data):
        """Automatically set created_at when creating"""
        if not validated_data.get("created_at"):
            validated_data["created_at"] = timezone.now()
        return super().create(validated_data)

class TblInboxSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblInbox
        fields = '__all__'

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
            'full_name'
        ]

    def get_full_name(self, obj):
        middle = f" {obj.middle_name[0]}." if obj.middle_name else ""
        return f"{obj.first_name}{middle} {obj.last_name}".strip()

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

    course_id = serializers.CharField(source='course.course_id', write_only=True)
    program_id = serializers.CharField(source='program.program_id', write_only=True)
    term_id = serializers.IntegerField(source='term.term_id', write_only=True)
    user_id = serializers.IntegerField(source='user.user_id', write_only=True, required=False, allow_null=True)

    class Meta:
        model = TblSectioncourse
        fields = [
            'id',
            'course', 'program', 'term', 'user',
            'course_id', 'program_id', 'term_id', 'user_id',
            'section_name', 'number_of_students', 'year_level'
        ]

    def create(self, validated_data):
        course_data = validated_data.pop('course')
        program_data = validated_data.pop('program')
        term_data = validated_data.pop('term')
        user_data = validated_data.pop('user', None)

        course = TblCourse.objects.get(course_id=course_data['course_id'])
        program = TblProgram.objects.get(program_id=program_data['program_id'])
        term = TblTerm.objects.get(term_id=term_data['term_id'])
        user = TblUsers.objects.get(user_id=user_data['user_id']) if user_data else None

        return TblSectioncourse.objects.create(
            course=course, program=program, term=term, user=user, **validated_data
        )

    def update(self, instance, validated_data):
        course_data = validated_data.pop('course', None)
        program_data = validated_data.pop('program', None)
        term_data = validated_data.pop('term', None)
        user_data = validated_data.pop('user', None)

        if course_data:
            instance.course = TblCourse.objects.get(course_id=course_data['course_id'])
        if program_data:
            instance.program = TblProgram.objects.get(program_id=program_data['program_id'])
        if term_data:
            instance.term = TblTerm.objects.get(term_id=term_data['term_id'])
        if user_data:
            instance.user = TblUsers.objects.get(user_id=user_data['user_id'])

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
    # Nested user data for read
    user = TblUsersSerializer(read_only=True)
    # Writable FK field - REMOVE the source parameter
    user_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = TblAvailability
        fields = [
            'availability_id',
            'day',
            'time_slot',
            'status',
            'remarks',
            'user',
            'user_id',
        ]

    def create(self, validated_data):
        # Extract user_id and create the availability
        user_id = validated_data.pop('user_id')
        user = TblUsers.objects.get(user_id=user_id)
        availability = TblAvailability.objects.create(user=user, **validated_data)
        return availability

    def update(self, instance, validated_data):
        # Extract user_id if present and update
        user_id = validated_data.pop('user_id', None)
        if user_id:
            instance.user = TblUsers.objects.get(user_id=user_id)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class TblModalitySerializer(serializers.ModelSerializer):
    # Foreign Keys (expanded for read)
    room = TblRoomsSerializer(read_only=True)
    user = TblUsersSerializer(read_only=True)
    course = CourseSerializer(read_only=True)  # ✅ ADD THIS LINE
    
    # Write-only FKs for POST/PUT
    room_id = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    user_id = serializers.IntegerField(write_only=True)
    course_id = serializers.CharField(write_only=True)
    
    # Handle possible_rooms as array
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
            'course',           # ✅ ADD THIS
            'course_id',
            'program_id',
            'room',
            'room_id',
            'user',
            'user_id',
            'created_at',
            'section_name',
            'possible_rooms',
        ]
    
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
    # FKs (expanded for reading)
    room = TblRoomsSerializer(read_only=True)
    modality = TblModalitySerializer(read_only=True)
    proctor = TblUsersSerializer(read_only=True)
    examperiod = serializers.StringRelatedField(read_only=True)

    # Write-only FK fields (for POST/PUT)
    room_id = serializers.CharField(write_only=True, required=False)  # FIXED: removed source
    modality_id = serializers.IntegerField(write_only=True, required=False)  # FIXED: removed source
    proctor_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)  # FIXED: removed source
    examperiod_id = serializers.IntegerField(write_only=True, required=False)  # FIXED: removed source

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
            'section_name',
            'academic_year',
            'semester',
            'exam_category',
            'exam_period',
            'exam_date',
            'college_name',
            'building_name',
            'instructor_id',
        ]

    def create(self, validated_data):
        # Extract FK IDs
        room_id = validated_data.pop('room_id', None)
        modality_id = validated_data.pop('modality_id', None)
        proctor_id = validated_data.pop('proctor_id', None)
        examperiod_id = validated_data.pop('examperiod_id', None)

        # Get FK instances
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
        # Extract FK IDs
        room_id = validated_data.pop('room_id', None)
        modality_id = validated_data.pop('modality_id', None)
        proctor_id = validated_data.pop('proctor_id', None)
        examperiod_id = validated_data.pop('examperiod_id', None)

        # Update FK instances
        if room_id is not None:
            instance.room = TblRooms.objects.get(room_id=room_id)
        if modality_id is not None:
            instance.modality = TblModality.objects.get(modality_id=modality_id)
        if proctor_id is not None:
            instance.proctor = TblUsers.objects.get(user_id=proctor_id) if proctor_id else None
        if examperiod_id is not None:
            instance.examperiod = TblExamperiod.objects.get(examperiod_id=examperiod_id)

        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance