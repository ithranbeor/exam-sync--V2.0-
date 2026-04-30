import { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts';
import { FaCalendarAlt, FaClock, FaChevronRight } from 'react-icons/fa';

interface ExamPeriod {
  examperiod_id: number;
  start_date: string;
  end_date: string;
  academic_year: string;
  exam_category: string;
  term_id: number | null;
  term_name: string;
  college_id: string | null;
  college_name: string;
}

interface ProctorAssignment {
  assignment_id: number;
  course_id: string;
  section: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  room_id: string;
  building: string;
  instructor: string;
  examdetails_status: string;
}

interface Term {
  term_id: number;
  term_name: string;
}

interface Props {
  user: {
    user_id: number;
    college_id?: string;
    [key: string]: any;
  } | null;
  onNavigate?: (key: string) => void;
}

const COLLEGE_COLORS: Record<string, string> = {
  csm:  '#18a209',
  citc: '#222222',
  cot:  '#f3510c',
  cea:  '#a71919',
  cste: '#088ecc',
  shs:  '#ffaa00',
};

const getCollegeColor = (college: string | null) => {
  if (!college) return '#092C4C';
  return COLLEGE_COLORS[college.toLowerCase()] ?? '#092C4C';
};

const ProctorUpcomingExams = ({ user, onNavigate }: Props) => {
  const [examPeriods, setExamPeriods]       = useState<ExamPeriod[]>([]);
  const [termMap, setTermMap]               = useState<Record<string, string>>({});
  const [userCollege, setUserCollege]       = useState<string | null>(null);
  const [assignments, setAssignments]       = useState<ProctorAssignment[]>([]);
  const [activeTab, setActiveTab]           = useState<'exams' | 'schedule'>('exams');

  // ── Resolve user college ─────────────────────────────────────────
  useEffect(() => {
    const resolve = async () => {
      if (!user?.user_id) return;
      if (user.college_id) { setUserCollege(user.college_id); return; }
      try {
        const { data: roles } = await api.get(`/tbl_user_role`, { params: { user_id: user.user_id } });
        const hit = roles?.find((r: any) => r.college_id || r.college);
        if (hit) { setUserCollege(hit.college_id || hit.college); return; }
        const { data: ud } = await api.get(`/tbl_users/${user.user_id}`);
        if (ud?.college_id) setUserCollege(ud.college_id);
      } catch { /* silent */ }
    };
    resolve();
  }, [user?.user_id]);

  // ── Exam periods & terms ─────────────────────────────────────────
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const [{ data: ep }, { data: td }] = await Promise.all([
          api.get<ExamPeriod[]>('/tbl_examperiod'),
          api.get<Term[]>('/tbl_term'),
        ]);
        if (ep) setExamPeriods(ep);
        if (td) {
          const m: Record<string, string> = {};
          td.forEach(t => (m[t.term_id] = t.term_name));
          setTermMap(m);
        }
      } catch { /* silent */ }
    };
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Proctor assignments ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.user_id) return;
    const fetch_ = async () => {
      try {
        const { data } = await api.get(`/proctor-assigned-exams/${user.user_id}/`);
        const upcoming  = Array.isArray(data?.upcoming)  ? data.upcoming  : [];
        const ongoing   = Array.isArray(data?.ongoing)   ? data.ongoing   : [];
        const map_ = (e: any): ProctorAssignment => ({
          assignment_id:      e.id,
          course_id:          e.course_id,
          section:            e.section_name || 'N/A',
          exam_date:          e.exam_date,
          exam_start_time:    e.exam_start_time,
          exam_end_time:      e.exam_end_time,
          room_id:            e.room_id,
          building:           e.building_name || 'N/A',
          instructor:         e.instructor_name || 'N/A',
          examdetails_status: e.status || 'pending',
        });
        const combined = [...upcoming.map(map_), ...ongoing.map(map_)]
          .sort((a, b) =>
            new Date(a.exam_start_time).getTime() - new Date(b.exam_start_time).getTime()
          );
        setAssignments(combined);
      } catch { /* silent */ }
    };
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, [user?.user_id]);

  // ── Derived ──────────────────────────────────────────────────────
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const collegeExams = examPeriods
    .filter(ep => {
      const d = new Date(ep.start_date);
      if (d < todayMidnight) return false;
      if (!userCollege) return true;
      return (
        ep.college_id?.toLowerCase()   === userCollege.toLowerCase() ||
        ep.college_name?.toLowerCase() === userCollege.toLowerCase()
      );
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  // Group by date
  const examsByDate = collegeExams.reduce<Record<string, ExamPeriod[]>>((acc, ep) => {
    const key = new Date(ep.start_date).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(ep);
    return acc;
  }, {});

  const upcomingAssigned = assignments.slice(0, 6);

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.slice(11, 16).split(':');
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const daysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - todayMidnight.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const collegeColor = getCollegeColor(userCollege);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'DM Sans', Arial, sans-serif",
    }}>

      {/* Header */}
      <div style={{
        padding: '18px 20px 0',
        borderBottom: '1.5px solid #f0f2f5',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: '#092C4C',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 15, flexShrink: 0,
            }}>
              <FaCalendarAlt />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f1923', lineHeight: 1 }}>
                Upcoming
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontFamily: 'monospace' }}>
                {userCollege
                  ? <span>Exam dates for <span style={{ color: collegeColor, fontWeight: 700 }}>{userCollege}</span></span>
                  : 'Exam dates & schedule'
                }
              </div>
            </div>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('exam-Date')}
              style={{
                background: 'none', border: '1.5px solid #e0e4ea',
                borderRadius: 8, padding: '5px 10px',
                fontSize: 11, color: '#374151', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontWeight: 600,
              }}
            >
              View all <FaChevronRight size={9} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['exams', 'schedule'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                borderBottom: `2.5px solid ${activeTab === tab ? '#092C4C' : 'transparent'}`,
                padding: '8px 0 10px',
                fontSize: 12,
                fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? '#092C4C' : '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'exams' ? `Exam Dates (${Object.keys(examsByDate).length})` : `My Schedule (${upcomingAssigned.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 16px' }}>

        {/* ── Tab: Exam Dates ── */}
        {activeTab === 'exams' && (
          <>
            {Object.keys(examsByDate).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                <FaCalendarAlt style={{ fontSize: 28, opacity: 0.3, marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic' }}>No upcoming exam dates</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(examsByDate).map(([dateStr, eps]) => {
                  const d = new Date(dateStr);
                  const days = daysUntil(dateStr);
                  const isToday   = days === 0;
                  const isTomorrow = days === 1;
                  const isSoon    = days <= 7;

                  const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow'
                    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                  const urgencyColor = isToday ? '#dc2626' : isTomorrow ? '#ea580c' : isSoon ? '#d97706' : '#092C4C';
                  const urgencyBg    = isToday ? '#fef2f2' : isTomorrow ? '#fff7ed' : isSoon ? '#fffbeb' : '#f8fafd';
                  const urgencyBorder= isToday ? '#fecaca' : isTomorrow ? '#fed7aa' : isSoon ? '#fde68a' : '#e5e7eb';

                  return (
                    <div key={dateStr} style={{
                      background: urgencyBg,
                      border: `1.5px solid ${urgencyBorder}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}>
                      {/* Date block */}
                      <div style={{
                        flexShrink: 0,
                        width: 40, textAlign: 'center',
                        background: urgencyColor,
                        borderRadius: 8, padding: '4px 2px',
                        color: '#fff',
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.85, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                          {d.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1, fontFamily: 'monospace' }}>
                          {d.getDate()}
                        </div>
                        <div style={{ fontSize: 8, opacity: 0.85, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                            {eps[0].exam_category} Exam
                          </span>
                          {(isToday || isTomorrow || isSoon) && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              background: urgencyColor, color: '#fff',
                              borderRadius: 20, padding: '2px 7px',
                              fontFamily: 'monospace', flexShrink: 0,
                            }}>
                              {isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : `${days}d`}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginBottom: 4 }}>
                          {termMap[String(eps[0].term_id)] || eps[0].term_name || 'Unknown Term'}
                          {eps[0].academic_year ? ` · ${eps[0].academic_year}` : ''}
                        </div>
                        {/* College badges for this date */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Array.from(new Set(eps.map(e => e.college_id || e.college_name).filter(Boolean))).map((col, i) => (
                            <span key={i} style={{
                              background: getCollegeColor(col as string),
                              color: '#fff',
                              borderRadius: 20,
                              padding: '1px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              fontFamily: 'monospace',
                            }}>
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: My Schedule ── */}
        {activeTab === 'schedule' && (
          <>
            {upcomingAssigned.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                <FaClock style={{ fontSize: 28, opacity: 0.3, marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic' }}>No upcoming assignments</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingAssigned.map((assign) => {
                  const d = new Date(assign.exam_date);
                  const days = daysUntil(assign.exam_date);
                  const isToday    = days === 0;
                  const isTomorrow = days === 1;
                  const isSoon     = days <= 7;
                  const urgencyColor = isToday ? '#dc2626' : isTomorrow ? '#ea580c' : isSoon ? '#d97706' : '#092C4C';

                  return (
                    <div key={assign.assignment_id} style={{
                      background: '#fff',
                      border: `1.5px solid ${isSoon ? '#fde68a' : '#e5e7eb'}`,
                      borderLeft: `4px solid ${urgencyColor}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      {/* Date pip */}
                      <div style={{
                        flexShrink: 0, textAlign: 'center',
                        width: 38,
                      }}>
                        <div style={{ fontSize: 9, color: '#9ca3af', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                          {d.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: urgencyColor, lineHeight: 1, fontFamily: 'monospace' }}>
                          {d.getDate()}
                        </div>
                        <div style={{ fontSize: 9, color: '#9ca3af', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{
                            background: 'linear-gradient(135deg, #092C4C 0%, #1a4d7a 100%)',
                            color: '#fff', borderRadius: 6,
                            padding: '2px 8px', fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                          }}>
                            {assign.course_id}
                          </span>
                          {(isToday || isTomorrow) && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              background: urgencyColor, color: '#fff',
                              borderRadius: 20, padding: '1px 6px', fontFamily: 'monospace',
                            }}>
                              {isToday ? 'TODAY' : 'TOMORROW'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {assign.section}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          {formatTime(assign.exam_start_time)} · {assign.building}, Rm {assign.room_id}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default ProctorUpcomingExams;