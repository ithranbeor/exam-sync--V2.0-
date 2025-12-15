# APPENDIX E: Snippet of Relevant Codes

## 1. Back-End Genetic Algorithm Initialization Code Snippet

**File:** `frontend/src/components/S_ExamGenerator.tsx`

```typescript
const generateRandomChromosome = (
  allModalities: any[],
  sortedDates: string[],
  validTimes: string[],
  eveningTimeSlots: string[],
  modalityRoomsMap: Map<string | number, string[]>,
  totalDurationMinutes: number,
  getAvailableProctors: (date: string, time: string) => number[],
  modalityMap: Map<string | number, any>,
  courseDateAssignment: Map<string, string>
): Chromosome => {
  const chromosome: Chromosome = [];

  // ✅ NEW: Create global trackers for this chromosome
  const globalTracker: GlobalTracker = {
    roomOccupancy: new Map(),
    proctorOccupancy: new Map(),
    courseAssignments: new Map()
  };

  const scheduledModalities = new Set<string | number>();
  const globalTimeSlotYearLevels = new Map<string, Map<string, Set<string>>>();

  const dayClassSections: any[] = [];
  const nightClassSections: any[] = [];

  allModalities.forEach(section => {
    if (section.is_night_class === "YES") {
      nightClassSections.push(section);
    } else {
      dayClassSections.push(section);
    }
  });

  // Group sections by course+night status
  const sectionsByCourseType = new Map<string, any[]>();
  allModalities.forEach(section => {
    const isNightClass = section.is_night_class === "YES";
    const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
    if (!sectionsByCourseType.has(courseKey)) sectionsByCourseType.set(courseKey, []);
    sectionsByCourseType.get(courseKey)!.push(section);
  });

  // ✅ IMPROVED: Assign one time slot per course type with GUARANTEED non-conflict
  const courseTypeTimeSlots = new Map<string, { date: string; timeSlot: string }>();

  sectionsByCourseType.forEach((sections, courseKey) => {
    const firstSection = sections[0];
    const isNightClass = firstSection.is_night_class === "YES";

    const validTimesForCourse = isNightClass
      ? eveningTimeSlots.filter(t => {
          const [h, m] = t.split(":").map(Number);
          const end = (h * 60 + m) + totalDurationMinutes;
          return end <= 21 * 60;
        })
      : validTimes.filter(t => !eveningTimeSlots.includes(t));

    const preferredTime = validTimesForCourse[0];
    const shuffledTimeList = [
      preferredTime,
      ...validTimesForCourse.slice(1).sort(() => Math.random() - 0.5)
    ];

    const courseId = firstSection.course_id;

    // ✅ FIX: Use the pre-assigned date from courseDateAssignment
    let date = courseDateAssignment.get(courseId);
    if (!date || !sortedDates.includes(date)) {
      date = sortedDates[Math.floor(Math.random() * sortedDates.length)];
      courseDateAssignment.set(courseId, date);
    }

    // ✅ Try to find a time slot where ALL sections can fit without conflicts
    let foundTimeSlot = false;
    for (const candidateTime of shuffledTimeList) {
      const startMinutes = timeToMinutes(candidateTime);
      const endMinutes = startMinutes + totalDurationMinutes;

      let canScheduleAll = true;
      for (const section of sections) {
        const suitableRooms = modalityRoomsMap.get(section.modality_id) || [];
        let foundRoom = false;

        for (const room of suitableRooms) {
          const roomDateKey = `${date}|${room}`;
          if (isResourceFree(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes)) {
            foundRoom = true;
            break;
          }
        }

        if (!foundRoom) {
          canScheduleAll = false;
          break;
        }
      }

      if (canScheduleAll) {
        courseTypeTimeSlots.set(courseKey, { date, timeSlot: candidateTime });
        globalTracker.courseAssignments.set(courseKey, { date, timeSlot: candidateTime });
        foundTimeSlot = true;
        break;
      }
    }

    if (!foundTimeSlot && validTimesForCourse.length > 0) {
      const timeSlot = shuffledTimeList[0];
      courseTypeTimeSlots.set(courseKey, { date, timeSlot });
      globalTracker.courseAssignments.set(courseKey, { date, timeSlot });
    }
  });

  // ✅ IMPROVED: Main scheduling loop with strict conflict checking
  const sortedModalities = [...dayClassSections, ...nightClassSections];

  sortedModalities.forEach(section => {
    if (scheduledModalities.has(section.modality_id)) return;
    if (!modalityMap.has(section.modality_id)) return;

    const isNightClass = section.is_night_class === "YES";
    const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
    const assignment = courseTypeTimeSlots.get(courseKey);
    if (!assignment) return;

    const { date, timeSlot } = assignment;
    const startMinutes = timeToMinutes(timeSlot);
    const endMinutes = startMinutes + totalDurationMinutes;

    // ✅ IMPROVED: Find room with capacity and conflict checking
    let roomId = "";
    const suitableRooms = modalityRoomsMap.get(section.modality_id) || [];
    const totalStudents = section.total_students || section.enrolled_students || 0;

    // Try to find a room that fits capacity AND has no conflicts
    for (const room of [...suitableRooms].sort(() => Math.random() - 0.5)) {
      const roomObj = roomsCache.find(r => r.room_id === room);
      const roomCapacity = roomObj?.room_capacity || 0;

      // Check capacity - skip rooms that are too small
      if (totalStudents > roomCapacity) {
        continue; // Skip this room, try next
      }

      const roomDateKey = `${date}|${room}`;

      // ✅ Use globalTracker (not finalTracker) inside generateRandomChromosome
      if (isResourceFree(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes)) {
        roomId = room;
        markResourceOccupied(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes, Number(section.modality_id));
        break;
      }
    }

    // ✅ If no room found with capacity, try any available room
    if (!roomId && suitableRooms.length > 0) {
      for (const room of [...suitableRooms].sort(() => Math.random() - 0.5)) {
        const roomDateKey = `${date}|${room}`;

        if (isResourceFree(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes)) {
          roomId = room;
          markResourceOccupied(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes, Number(section.modality_id));
          break;
        }
      }
    }

    // ✅ Last resort: pick first available room regardless
    if (!roomId && suitableRooms.length > 0) {
      roomId = suitableRooms[0];
      const roomDateKey = `${date}|${roomId}`;
      markResourceOccupied(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes, Number(section.modality_id));
    }

    // ✅ IMPROVED: Proctor assignment with strict conflict checking
    let proctorId = -1;
    const availableProctors = getAvailableProctors(date, timeSlot) || [];
    const shuffledProctors = [...availableProctors].sort(() => Math.random() - 0.5);

    // Priority 1: Night class instructor (only if available and no conflict)
    if (isNightClass && section.instructor_id) {
      const instrKey = `${date}|${section.instructor_id}`;
      if (availableProctors.includes(section.instructor_id) &&
        isResourceFree(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes)) {
        proctorId = section.instructor_id;
        markResourceOccupied(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes, Number(section.modality_id));
      }
    }

    // Priority 2: Find any free proctor from available list
    if (proctorId === -1) {
      for (const pid of shuffledProctors) {
        const key = `${date}|${pid}`;
        if (isResourceFree(globalTracker.proctorOccupancy, key, startMinutes, endMinutes)) {
          proctorId = pid;
          markResourceOccupied(globalTracker.proctorOccupancy, key, startMinutes, endMinutes, Number(section.modality_id));
          break;
        }
      }
    }

    // Priority 3: Use section instructor as fallback (only if no conflict)
    if (proctorId === -1 && section.instructor_id) {
      const instrKey = `${date}|${section.instructor_id}`;
      if (isResourceFree(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes)) {
        proctorId = section.instructor_id;
        markResourceOccupied(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes, Number(section.modality_id));
      }
    }

    // ✅ Final validation before adding to chromosome
    if (!roomId) {
      return; // Don't add - missing room is a hard blocker
    }

    scheduledModalities.add(section.modality_id);
    chromosome.push({ sectionId: section.modality_id, date, timeSlot, roomId, proctorId });
  });

  return chromosome;
};
```

---

## 2. Back-End Custom View Time Slot Code Snippet

**File:** `backend/api/views.py`

```python
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
        if user_id:
            deleted_count = TblAvailability.objects.filter(user__user_id=user_id).delete()[0]
            return Response({
                'deleted_count': deleted_count,
                'message': f'Successfully deleted {deleted_count} availability record(s)'
            }, status=status.HTTP_200_OK)
        return Response({
            'error': 'user_id parameter is required for DELETE'
        }, status=status.HTTP_400_BAD_REQUEST)
```

---

## 3. Back-End Genetic Algorithm Fitness Function Code Snippet

**File:** `frontend/src/components/S_ExamGenerator.tsx`

```typescript
const calculateFitness = (
  chromosome: Chromosome,
  sectionMap: Map<string | number, any>,
  totalDurationMinutes: number,
  programs: any[],
  departments: any[]
): number => {
  let fitness = 0;

  const roomTimeRanges = new Map<string, Array<{ start: number; end: number; sectionId: number }>>();
  const proctorTimeRanges = new Map<string, Array<{ start: number; end: number; sectionId: number; deptId: string }>>();
  const studentSchedule = new Map<string, Set<string>>();
  const sectionScheduledCount = new Map<string | number, number>();
  const yearLevelByTimeSlotAndCollege = new Map<string, Map<string, Set<string>>>();
  const courseDateAssignments = new Map<string, Set<string>>();
  const courseTimeSlots = new Map<string, Map<string, Set<string>>>();

  chromosome.forEach(gene => {
    const section = sectionMap.get(gene.sectionId);
    if (!section) return;

    const { date, timeSlot, roomId } = gene;
    let proctorId = gene.proctorId;
    const startMinutes = timeToMinutes(timeSlot);
    const endMinutes = startMinutes + totalDurationMinutes;
    const yearLevel = extractYearLevel(section.section_name);
    const courseId = section.course_id;
    const programId = section.program_id;

    const program = programs.find(p => p.program_id === programId);
    const departmentId = program ? String(program.department_id) : "unknown";
    const department = departments.find(d => String(d.department_id) === departmentId);
    const collegeId = department ? String(department.college_id) : "unknown";

    sectionScheduledCount.set(gene.sectionId, (sectionScheduledCount.get(gene.sectionId) || 0) + 1);
    if (sectionScheduledCount.get(gene.sectionId)! > 1) {
      fitness -= 10000;
    }

    if (!courseDateAssignments.has(courseId)) {
      courseDateAssignments.set(courseId, new Set());
    }
    courseDateAssignments.get(courseId)!.add(date);
    if (courseDateAssignments.get(courseId)!.size > 1) {
      fitness -= 25000;
    }

    if (!courseTimeSlots.has(courseId)) {
      courseTimeSlots.set(courseId, new Map());
    }
    if (!courseTimeSlots.get(courseId)!.has(date)) {
      courseTimeSlots.get(courseId)!.set(date, new Set());
    }
    const courseTimesForDate = courseTimeSlots.get(courseId)!.get(date)!;
    if (courseTimesForDate.size > 0) {
      const existingTimeSlot = Array.from(courseTimesForDate)[0];
      if (existingTimeSlot !== timeSlot) {
        fitness -= 15000;
      }
    }
    courseTimesForDate.add(timeSlot);

    const studentKey = `${yearLevel}-${programId}`;
    const timeSlots = getTimeSlots(timeSlot, totalDurationMinutes);
    timeSlots.forEach(slot => {
      const key = `${date}|${slot}`;
      if (!studentSchedule.has(key)) studentSchedule.set(key, new Set());
      if (studentSchedule.get(key)!.has(studentKey)) {
        fitness -= 5000;
      }
      studentSchedule.get(key)!.add(studentKey);
    });

    const timeSlotKey = `${date}|${timeSlot}`;
    if (!yearLevelByTimeSlotAndCollege.has(timeSlotKey)) {
      yearLevelByTimeSlotAndCollege.set(timeSlotKey, new Map());
    }
    const collegeMap = yearLevelByTimeSlotAndCollege.get(timeSlotKey)!;
    if (!collegeMap.has(collegeId)) {
      collegeMap.set(collegeId, new Set());
    }
    collegeMap.get(collegeId)!.add(yearLevel);

    if (collegeMap.get(collegeId)!.size > 1) {
      fitness -= 8000;
    }

    if (!roomId) {
      fitness -= 8000;
    } else {
      const roomDateKey = `${date}|${roomId}`;
      if (!roomTimeRanges.has(roomDateKey)) {
        roomTimeRanges.set(roomDateKey, []);
      }
      const existingRanges = roomTimeRanges.get(roomDateKey)!;
      existingRanges.forEach(existing => {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          fitness -= 20000;
        }
      });
      existingRanges.push({ start: startMinutes, end: endMinutes, sectionId: Number(gene.sectionId) });
    }

    if (proctorId === -1) {
      proctorId = -9999;
      const proctorDateKey = `${date}|${proctorId}`;
      if (!proctorTimeRanges.has(proctorDateKey)) {
        proctorTimeRanges.set(proctorDateKey, []);
      }
      proctorTimeRanges.get(proctorDateKey)!.push({
        start: startMinutes,
        end: endMinutes,
        sectionId: Number(gene.sectionId),
        deptId: departmentId
      });
    } else {
      const proctorDateKey = `${date}|${proctorId}`;
      if (!proctorTimeRanges.has(proctorDateKey)) {
        proctorTimeRanges.set(proctorDateKey, []);
      }
      const existingProctorRanges = proctorTimeRanges.get(proctorDateKey)!;

      existingProctorRanges.forEach(existing => {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          fitness -= 30000;
        }
      });

      existingProctorRanges.push({
        start: startMinutes,
        end: endMinutes,
        sectionId: Number(gene.sectionId),
        deptId: departmentId
      });
    }

    if (roomId && proctorId !== -1) {
      fitness += 1000;
    }
  });

  return fitness;
};
```

---

## 4. Back-End Genetic Algorithm Mutate Function Code Snippet

**File:** `frontend/src/components/S_ExamGenerator.tsx`

```typescript
const mutate = (
  chromosome: Chromosome,
  sectionMap: Map<string | number, any>,
  sortedDates: string[],
  validTimes: string[],
  eveningTimeSlots: string[],
  modalityRoomsMap: Map<string | number, string[]>,
  getAvailableProctors: (date: string, time: string) => number[],
  mutationRate: number
): Chromosome => {

  const courseTypeTimeSlots = new Map<string, { date: string; timeSlot: string }>();

  chromosome.forEach(gene => {
    const section = sectionMap.get(gene.sectionId);
    if (section) {
      const isNightClass = section.is_night_class === "YES";
      const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;

      if (!courseTypeTimeSlots.has(courseKey)) {
        courseTypeTimeSlots.set(courseKey, { date: gene.date, timeSlot: gene.timeSlot });
      }
    }
  });

  const mutatedCourses = new Map<string, { date?: string; timeSlot?: string }>();

  chromosome.forEach(gene => {
    if (Math.random() >= mutationRate) return;

    const section = sectionMap.get(gene.sectionId);
    if (!section) return;

    const isNightClass = section.is_night_class === "YES";
    const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;

    if (mutatedCourses.has(courseKey)) return;

    const mutationType = Math.floor(Math.random() * 4);
    const validTimesForSection = isNightClass
      ? eveningTimeSlots.filter(t => {
          const [h, m] = t.split(":").map(Number);
          const totalDurationMinutes = duration.hours * 60 + duration.minutes;
          const end = (h * 60 + m) + totalDurationMinutes;
          return end <= 21 * 60;
        })
      : validTimes;

    if (mutationType === 0 && Math.random() < 0.3) {
      const newDate = sortedDates[Math.floor(Math.random() * sortedDates.length)];
      mutatedCourses.set(courseKey, { date: newDate });
      courseTypeTimeSlots.set(courseKey, { date: newDate, timeSlot: gene.timeSlot });

    } else if (mutationType === 1) {
      const newTimeSlot = validTimesForSection[Math.floor(Math.random() * validTimesForSection.length)];
      mutatedCourses.set(courseKey, { timeSlot: newTimeSlot });
      courseTypeTimeSlots.set(courseKey, { date: gene.date, timeSlot: newTimeSlot });
    }
  });

  return chromosome.map(gene => {
    const section = sectionMap.get(gene.sectionId);
    if (!section) return { ...gene };

    const isNightClass = section.is_night_class === "YES";
    const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
    const suitableRooms = modalityRoomsMap.get(gene.sectionId) || [];

    const courseMutation = mutatedCourses.get(courseKey);
    if (courseMutation) {
      let newGene = { ...gene };

      if (courseMutation.date) {
        newGene.date = courseMutation.date;
      }

      if (courseMutation.timeSlot) {
        newGene.timeSlot = courseMutation.timeSlot;
      }

      const availableProctors = getAvailableProctors(newGene.date, newGene.timeSlot);
      let newProctorId = -1;

      if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
        newProctorId = section.instructor_id;
      } else {
        const shuffled = [...availableProctors].sort(() => Math.random() - 0.5);
        newProctorId = shuffled.length > 0 ? shuffled[0] : -1;
      }

      newGene.proctorId = newProctorId;
      return newGene;
    }

    if (Math.random() < mutationRate) {
      const mutationType = Math.floor(Math.random() * 4);

      if (mutationType === 2) {
        const newRoomId = suitableRooms.length > 0
          ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)]
          : "";
        return { ...gene, roomId: newRoomId };

      } else if (mutationType === 3) {
        const availableProctors = getAvailableProctors(gene.date, gene.timeSlot);
        let newProctorId = -1;

        if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
          newProctorId = section.instructor_id;
        } else {
          const shuffled = [...availableProctors].sort(() => Math.random() - 0.5);
          newProctorId = shuffled.length > 0 ? shuffled[0] : -1;
        }

        return { ...gene, proctorId: newProctorId };
      }
    }

    return { ...gene };
  });
};
```

---

## 5. Back-End Genetic Algorithm Code Snippet (Main GA Loop)

**File:** `frontend/src/components/S_ExamGenerator.tsx`

```typescript
const assignExamSchedules = async () => {
  if (allCollegeUsers.length === 0) {
    alert("No proctors found for your college. Please ensure proctors are assigned.");
    return;
  }

  const POPULATION_SIZE = 50;
  const GENERATIONS = 100;
  const MUTATION_RATE = 0.25;
  const ELITE_SIZE = 5;
  const YIELD_EVERY_N_GENERATIONS = 10;

  const totalDurationMinutes = duration.hours * 60 + duration.minutes;

  // ... (setup code for dates, availability, time slots, etc.)

  // Initialize population
  let population: Chromosome[] = [];
  for (let i = 0; i < POPULATION_SIZE; i++) {
    population.push(generateRandomChromosome(
      allModalities,
      sortedDates,
      prioritizedValidTimes,
      eveningTimeSlots,
      modalityRoomsMap,
      totalDurationMinutes,
      getAvailableProctors,
      modalityMap,
      courseDateAssignment
    ));
  }

  let bestChromosome: Chromosome | null = null;
  let bestFitness = -Infinity;

  setIsGenerating(true);
  setGenerationProgress(0);

  // Main Genetic Algorithm Loop
  for (let generation = 0; generation < GENERATIONS; generation++) {
    // Update progress
    const progress = Math.round((generation / GENERATIONS) * 100);
    setGenerationProgress(progress);

    if (generation % YIELD_EVERY_N_GENERATIONS === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Evaluate fitness for all chromosomes
    const fitnesses = population.map(c => calculateFitness(c, modalityMap, totalDurationMinutes, programs, departments));
    const currentBestIdx = fitnesses.indexOf(Math.max(...fitnesses));

    // Track best chromosome
    if (fitnesses[currentBestIdx] > bestFitness) {
      bestFitness = fitnesses[currentBestIdx];
      bestChromosome = population[currentBestIdx];
    }

    // Create next generation
    const nextPopulation: Chromosome[] = [];
    const sortedIndices = fitnesses
      .map((fit, idx) => ({ fit, idx }))
      .sort((a, b) => b.fit - a.fit)
      .map(x => x.idx);

    // Elitism: Keep top performers
    for (let i = 0; i < ELITE_SIZE; i++) {
      nextPopulation.push(population[sortedIndices[i]].map(gene => ({ ...gene })));
    }

    // Generate new population through selection, crossover, and mutation
    while (nextPopulation.length < POPULATION_SIZE) {
      const parent1 = tournamentSelection(population, fitnesses);
      const parent2 = tournamentSelection(population, fitnesses);
      const [child1, child2] = crossover(parent1, parent2);
      nextPopulation.push(mutate(child1, modalityMap, sortedDates, prioritizedValidTimes, eveningTimeSlots, modalityRoomsMap, getAvailableProctors, MUTATION_RATE));
      if (nextPopulation.length < POPULATION_SIZE) {
        nextPopulation.push(mutate(child2, modalityMap, sortedDates, prioritizedValidTimes, eveningTimeSlots, modalityRoomsMap, getAvailableProctors, MUTATION_RATE));
      }
    }

    population = nextPopulation;
  }

  setGenerationProgress(100);
  setIsGenerating(false);

  if (!bestChromosome) {
    alert("Could not find a valid schedule.");
    return;
  }

  // ... (convert bestChromosome to schedule format and save)
};
```

---

## 6. Back-End Models Code Snippet

**File:** `backend/api/models.py`

```python
class TblAvailability(models.Model):
    availability_id = models.AutoField(primary_key=True)
    days = ArrayField(models.DateField(), blank=False)  # array of dates
    time_slots = ArrayField(models.CharField(max_length=50), blank=False)  # array of time slots
    status = models.CharField(max_length=20)
    remarks = models.TextField(blank=True, null=True)
    user = models.ForeignKey('TblUsers', on_delete=models.CASCADE)

    class Meta:
        managed = True
        db_table = 'tbl_availability'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status']),
        ]


class TblExamdetails(models.Model):
    examdetails_id = models.AutoField(primary_key=True)
    course_id = models.CharField(max_length=50)
    program_id = models.TextField()
    room = models.ForeignKey('TblRooms', models.DO_NOTHING)
    modality = models.ForeignKey('TblModality', models.DO_NOTHING)
    proctor = models.ForeignKey('TblUsers', models.DO_NOTHING, blank=True, null=True)
    examperiod = models.ForeignKey('TblExamperiod', models.DO_NOTHING)
    exam_duration = models.DurationField(blank=True, null=True)
    exam_start_time = models.DateTimeField(blank=True, null=True)
    exam_end_time = models.DateTimeField(blank=True, null=True)
    
    # ✅ NEW: Changed to ArrayField for multiple sections
    sections = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        null=True,
        default=list
    )
    
    # ✅ NEW: Store multiple instructors and proctors
    instructors = ArrayField(
        models.IntegerField(),
        blank=True,
        null=True,
        default=list
    )
    
    proctors = ArrayField(
        models.IntegerField(),
        blank=True,
        null=True,
        default=list
    )
    
    # Keep legacy fields for backward compatibility
    section_name = models.CharField(blank=True, null=True)
    instructor_id = models.IntegerField(blank=True, null=True)
    
    academic_year = models.TextField(blank=True, null=True)
    semester = models.TextField(blank=True, null=True)
    exam_category = models.TextField(blank=True, null=True)
    exam_period = models.TextField(blank=True, null=True)
    exam_date = models.TextField(blank=True, null=True)
    college_name = models.TextField(blank=True, null=True)
    building_name = models.CharField(blank=True, null=True)

    class Meta:
        managed = True
        db_table = 'tbl_examdetails'
        indexes = [
            models.Index(fields=['room']),
            models.Index(fields=['modality']),
            models.Index(fields=['proctor']),
            models.Index(fields=['examperiod']),
            models.Index(fields=['exam_date']),
            models.Index(fields=['course_id']),
        ]


class TblExamOtp(models.Model):
    """
    Stores generated OTP codes for each exam schedule
    Format: [Building][Room]-[CourseCode]-[RandomCode]
    Example: 09306-IT114-X5P9K
    """
    otp_id = models.AutoField(primary_key=True)
    examdetails = models.OneToOneField(
        'TblExamdetails', 
        on_delete=models.CASCADE,
        related_name='otp_record'
    )
    otp_code = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        managed = True
        db_table = 'tbl_exam_otp'
        indexes = [
            models.Index(fields=['otp_code']),
            models.Index(fields=['examdetails']),
        ]
    
    def __str__(self):
        return f"{self.otp_code} - {self.examdetails.course_id}"


class TblModality(models.Model):
    modality_id = models.AutoField(primary_key=True)
    modality_type = models.TextField()
    room_type = models.TextField()
    modality_remarks = models.TextField(blank=True, null=True)
    course = models.ForeignKey(TblCourse, models.DO_NOTHING)
    program_id = models.TextField()
    room = models.ForeignKey('TblRooms', models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey('TblUsers', models.DO_NOTHING)
    created_at = models.DateTimeField(blank=True, null=True)
    
    sections = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        null=True,
        default=list
    )
    
    total_students = models.IntegerField(default=0, blank=True, null=True)
    
    possible_rooms = ArrayField(
        models.CharField(max_length=50),
        blank=True,
        null=True,
        default=list
    )

    class Meta:
        managed = True
        db_table = 'tbl_modality'
```

---

## 7. Code for Exam CODE Generation (Backend)

**File:** `backend/api/views.py`

```python
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
```

---

## 8. Front-End Generate Schedule Template Code Snippet

**File:** `frontend/src/components/S_ExamGenerator.tsx`

```typescript
const SchedulerPlottingSchedule: React.FC<SchedulerProps> = ({ user, onScheduleCreated }) => {
  const [formData, setFormData] = useState({
    academic_year: "",
    exam_category: "",
    selectedPrograms: [] as string[],
    selectedCourses: [] as string[],
    selectedModalities: [] as number[],
    selectedExamDates: [] as string[],
  });

  const [duration, setDuration] = useState({ hours: 1, minutes: 0 });
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // ... (other state variables and data fetching)

  const handleSaveClick = async () => {
    if (!formData.academic_year || !formData.exam_category || formData.selectedExamDates.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.selectedModalities.length === 0) {
      toast.error("Please select at least one modality");
      return;
    }

    await assignExamSchedules();
  };

  return (
    <div className="scheduler-container">
      {/* Form fields for academic year, exam category, programs, courses, dates, duration, etc. */}
      
      {/* Generate Button */}
      <div className="save-button-wrapper">
        <button
          type="button"
          onClick={handleSaveClick}
          className={`btn-saves ${isGenerating ? 'generating' : ''}`}
          disabled={loading || alreadyScheduledIds.size > 0 || isGenerating}
        >
          {isGenerating ? (
            <div className="loading-progress">
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <div className="progress-info">
                <span className="progress-number">{generationProgress}%</span>
                <span className="progress-text">Generating optimal schedule...</span>
              </div>
            </div>
          ) : (
            <>
              <FaPlay className="icon-play" style={{ fontSize: '16px' }} />
              <span>Generate Schedule</span>
            </>
          )}
        </button>
        {alreadyScheduledIds.size > 0 && !isGenerating && (
          <p className="button-warning">
            ⚠️ Remove {alreadyScheduledIds.size} already scheduled section{alreadyScheduledIds.size > 1 ? 's' : ''} to proceed
          </p>
        )}
      </div>

      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default SchedulerPlottingSchedule;
```

---

**Note:** All code snippets reflect the current state of the codebase after recent changes. The genetic algorithm implementation is located in the frontend component `S_ExamGenerator.tsx`, while the backend handles data models, API views, and OTP code generation.

