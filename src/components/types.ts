
export interface Course {
  course_id: string;
  course_name: string;
}

export interface Proctor {
  user_id: number;
  full_name: string;
}

export interface Modality {
  modality_id: number;
  modality_type: string;
  room_type: string;
  modality_remarks: string;
  course_id: string;
  program_id: string;
  room_id: string | null;
  possible_rooms?: string[];
  section_name: string;
  user_id: number;
  section?: {
    year_level: string;
    term: {
      term_name: string;
    };
  };
}

export interface SectionCourse {
  course_id: string;
  program_id: string;
  year_level: string;
  term: {
    term_name: string;
  };
  user_id: number;
  section_name?: string;
}

export interface Program {
  program_id: string;
  program_name: string;
}

export interface Room {
  room_id: string;
  room_name: string;
  building?: {
    building_id: string;
    building_name: string;
  };
}

export interface ExamPeriod {
  examperiod_id: number;
  start_date: string;
  end_date: string;
  academic_year: string;
  exam_category: string;
  college_id?: string;
  term: {
    term_name: string;
  };
  college: {
    college_name: string;
  };
}

export interface ExamDetail {
  examdetails_id: string;
  course_id: string;
  program_id: string;
  room_id: string;
  modality_id: string;
  user_id: string;
  exam_period: string;
  exam_date: string;
  exam_duration: string;
  exam_start_time: string;
  exam_end_time: string;
  time_in: string | null;
  time_out: string | null;
  section_name: string;
  academic_year: string;
  semester: string;
  exam_category: string;
}
export interface AvailabilityEntry {
  status: 'available' | 'unavailable';
  day: string;
  time_slot: string;
  user_id: number;
  tbl_users: {
    first_name: string;
    last_name: string;
  }[]; // <--- array
}
