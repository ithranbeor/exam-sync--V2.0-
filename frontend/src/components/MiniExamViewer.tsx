import React, { useEffect, useState } from "react";
import { api } from "../lib/apiClient.ts";

interface ExamDetail {
  examdetails_id?: number;
  course_id: string;
  section_name?: string;
  sections?: string[];
  room_id?: string;
  exam_date?: string;
  exam_start_time?: string;
  exam_end_time?: string;
  semester?: string;
  academic_year?: string;
  building_name?: string;
  program_id?: string;
  college_name?: string;
  modality_id?: number;
  exam_period?: string;
  exam_category?: string;
  instructor_id?: number;
  instructors?: number[];
  proctor_id?: number;
  proctors?: number[];
}

interface MiniExamViewerProps {
  user: {
    user_id: number;
    first_name?: string;
    last_name?: string;
  } | null;
}

const MiniExamViewer: React.FC<MiniExamViewerProps> = ({ user }) => {
  const [examData, setExamData] = useState<ExamDetail[]>([]);
  const [collegeName, setCollegeName] = useState<string>("");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve college from any active role that has college_id
  useEffect(() => {
    const fetchCollege = async () => {
      if (!user?.user_id) {
        setIsLoading(false);
        return;
      }
      try {
        const rolesRes = await api.get("/tbl_user_role", { params: { user_id: user.user_id } });
        const roles = rolesRes.data || [];
        const withCollege = roles.find((r: any) => r.college_id);
        if (!withCollege) {
          setIsLoading(false);
          return;
        }
        const collegeRes = await api.get(`/tbl_college/${withCollege.college_id}/`);
        setCollegeName(collegeRes.data?.college_name || "");
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    fetchCollege();
  }, [user]);

  // Fetch exams for the college
  useEffect(() => {
    if (!collegeName) return;
    const fetch = async () => {
      try {
        const res = await api.get("/tbl_examdetails", { params: { college_name: collegeName } });
        setExamData(res.data || []);
      } catch {
        setExamData([]);
      }
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [collegeName]);

  // Check approval status
  useEffect(() => {
    if (!collegeName) return;
    const check = async () => {
      try {
        const res = await api.get("/tbl_scheduleapproval/", { params: { college_name: collegeName } });
        if (res.data && res.data.length > 0) {
          const sorted = [...res.data].sort(
            (a: any, b: any) =>
              new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          );
          setApprovalStatus(sorted[0].status as "pending" | "approved" | "rejected");
        } else {
          setApprovalStatus(null);
        }
      } catch {
        setApprovalStatus(null);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [collegeName, examData.length]);

  const termName = examData.find((e) => e.exam_category)?.exam_category ?? "-";
  const semesterName = examData.find((e) => e.semester)?.semester ?? "-";
  const yearName = examData.find((e) => e.academic_year)?.academic_year ?? "-";
  const examPeriodName = examData.find((e) => e.exam_period)?.exam_period ?? "-";
  const displayCollege = collegeName || "Your College";

  // ── Shared header ──────────────────────────────────────────────
  const Header = () => (
    <div style={{ textAlign: "center", marginBottom: "12px" }}>
      <img
        src="/logo/USTPlogo.png"
        alt="School Logo"
        style={{ width: 64, height: 52, marginBottom: 4 }}
      />
      <div style={{ fontSize: 11, color: "#333", fontFamily: "serif", fontWeight: 700 }}>
        University of Science and Technology of Southern Philippines
      </div>
      <div style={{ fontSize: 9, color: "#666", fontFamily: "serif", marginBottom: 2 }}>
        Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
      </div>
      <div style={{ fontSize: 13, color: "#092C4C", fontFamily: "serif", fontWeight: 700 }}>
        {displayCollege}
      </div>
      <div style={{ fontSize: 11, color: "#333", fontFamily: "serif", fontWeight: 600 }}>
        Examination Schedule
      </div>
      <hr style={{ margin: "8px 0 0" }} />
    </div>
  );

  // ── Status card (no schedule / pending / rejected) ─────────────
  const statusConfig = {
    pending: {
      bg: "#fff8e1",
      border: "#f59e0b",
      iconColor: "#d97706",
      icon: "⏳",
      title: "Schedule Pending Approval",
      message: "The exam schedule has been submitted and is currently awaiting dean approval.",
    },
    rejected: {
      bg: "#fff1f2",
      border: "#dc2626",
      iconColor: "#dc2626",
      icon: "✕",
      title: "Schedule Rejected",
      message: "The schedule was rejected. Please contact your scheduler for an updated schedule.",
    },
    none: {
      bg: "#f8fafc",
      border: "#cbd5e1",
      iconColor: "#94a3b8",
      icon: "📅",
      title: "No Schedule Available",
      message: "No approved exam schedule has been published for your college yet.",
    },
  };

  if (isLoading) {
    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1.5px solid #e2e8f0",
          padding: 16,
          minHeight: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#92a3b8",
          fontSize: 13,
        }}
      >
        Loading schedule...
      </div>
    );
  }

  if (approvalStatus !== "approved") {
    const cfg =
      approvalStatus === "pending"
        ? statusConfig.pending
        : approvalStatus === "rejected"
        ? statusConfig.rejected
        : statusConfig.none;

    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1.5px solid #e2e8f0",
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <Header />
        <div
          style={{
            background: cfg.bg,
            border: `1.5px solid ${cfg.border}`,
            borderRadius: 10,
            padding: "24px 16px",
            textAlign: "center",
            marginTop: 12,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>{cfg.icon}</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: cfg.iconColor,
              marginBottom: 6,
              fontFamily: "serif",
            }}
          >
            {cfg.title}
          </div>
          <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>{cfg.message}</div>
        </div>
      </div>
    );
  }

  // ── Approved: show mini table for the nearest upcoming exam date ─
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingDates = Array.from(new Set(examData.map((e) => e.exam_date).filter(Boolean)))
    .sort()
    .filter((d) => new Date(d!) >= today);

  const displayDate = upcomingDates[0] || Array.from(new Set(examData.map((e) => e.exam_date).filter(Boolean))).sort().slice(-1)[0];

  const dateExams = examData.filter((e) => e.exam_date === displayDate);
  const rooms = Array.from(new Set(dateExams.map((e) => e.room_id).filter(Boolean))).sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true })
  );

  const rawTimes = [
    "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
    "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
    "15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30",
    "19:00","19:30","20:00","20:30","21:00",
  ];

  const formatTo12 = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const timeSlots = rawTimes.slice(0, -1).map((t, i) => ({
    start24: t,
    end24: rawTimes[i + 1],
    label: `${formatTo12(t)}`,
  }));

  // Only show slots that have at least one exam
  const activeSlots = timeSlots.filter((slot) =>
    dateExams.some((e) => {
      if (!e.exam_start_time || !e.exam_end_time) return false;
      const s = e.exam_start_time.slice(11, 16);
      const en = e.exam_end_time.slice(11, 16);
      const [sh, sm] = s.split(":").map(Number);
      const [eh, em] = en.split(":").map(Number);
      const examS = sh * 60 + sm;
      const examE = eh * 60 + em;
      const slotS = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
      const slotE = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
      return examS < slotE && examE > slotS;
    })
  );

  // color map
  const colors = ["#2563EB","#DC2626","#059669","#D97706","#7C3AED","#DB2777","#0891B2","#EA580C"];
  const courseColorMap: Record<string, string> = {};
  let ci = 0;
  examData.forEach((e) => {
    if (e.course_id && !courseColorMap[e.course_id]) {
      courseColorMap[e.course_id] = colors[ci % colors.length];
      ci++;
    }
  });

  const groupedData: Record<string, ExamDetail[]> = {};
  dateExams.forEach((exam) => {
    if (!exam.room_id) return;
    const key = `${displayDate}-${exam.room_id}`;
    if (!groupedData[key]) groupedData[key] = [];
    groupedData[key].push(exam);
  });

  const occupiedCells: Record<string, boolean> = {};

  // show max 4 rooms to keep it compact
  const visibleRooms = rooms.slice(0, 4);
  const hiddenRooms = rooms.length - visibleRooms.length;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1.5px solid #e2e8f0",
        padding: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        overflowX: "auto",
      }}
    >
      <Header />

      {/* Sub-header info */}
      <div style={{ fontSize: 10, color: "#555", fontFamily: "serif", textAlign: "center", marginBottom: 6 }}>
        <strong>{termName}</strong> | {semesterName} Semester | A.Y. {yearName} | {examPeriodName}
      </div>

      {/* Date label */}
      <div
        style={{
          background: "#092C4C",
          color: "#fff",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {displayDate
          ? new Date(displayDate).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "No upcoming date"}
        {upcomingDates.length > 1 && (
          <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 9, opacity: 0.8 }}>
            (+{upcomingDates.length - 1} more date{upcomingDates.length - 1 !== 1 ? "s" : ""})
          </span>
        )}
      </div>

      {dateExams.length === 0 ? (
        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, padding: "20px 0" }}>
          No exams scheduled for this date.
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      width: 70,
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      padding: "4px 2px",
                      color: "#475569",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    Time
                  </th>
                  {visibleRooms.map((room) => (
                    <th
                      key={String(room)}
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        padding: "4px 2px",
                        color: "#475569",
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Room {room}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSlots.map((slot, rowIndex) => (
                  <tr key={slot.start24}>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "3px 4px",
                        color: "#64748b",
                        fontWeight: 600,
                        textAlign: "center",
                        background: "#fafafa",
                        whiteSpace: "nowrap",
                        fontSize: 9,
                      }}
                    >
                      {slot.label}
                    </td>
                    {visibleRooms.map((room) => {
                      const cellKey = `${displayDate}-${room}-${rowIndex}`;
                      if (occupiedCells[cellKey]) return null;

                      const examsInRoom = groupedData[`${displayDate}-${room}`] || [];
                      const exam = examsInRoom.find((e) => {
                        if (!e.exam_start_time || !e.exam_end_time) return false;
                        const s = e.exam_start_time.slice(11, 16);
                        const en = e.exam_end_time.slice(11, 16);
                        const [sh, sm] = s.split(":").map(Number);
                        const [eh, em] = en.split(":").map(Number);
                        const examS = sh * 60 + sm;
                        const examE = eh * 60 + em;
                        const slotS =
                          Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                        const slotE =
                          Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                        return examS < slotE && examE > slotS;
                      });

                      if (!exam) {
                        return (
                          <td
                            key={String(room)}
                            style={{ border: "1px solid #e2e8f0", background: "#fff" }}
                          />
                        );
                      }

                      const s = exam.exam_start_time!.slice(11, 16);
                      const en = exam.exam_end_time!.slice(11, 16);
                      const [sh, sm] = s.split(":").map(Number);
                      const [eh, em] = en.split(":").map(Number);
                      const startMin = sh * 60 + sm;
                      const endMin = eh * 60 + em;

                      const startSlotIdx = activeSlots.findIndex((sl) => {
                        const slotS =
                          Number(sl.start24.split(":")[0]) * 60 + Number(sl.start24.split(":")[1]);
                        const slotE =
                          Number(sl.end24.split(":")[0]) * 60 + Number(sl.end24.split(":")[1]);
                        return startMin >= slotS && startMin < slotE;
                      });
                      const rowSpan = Math.max(1, Math.ceil((endMin - startMin) / 30));

                      for (let i = 0; i < rowSpan; i++) {
                        if (startSlotIdx + i < activeSlots.length) {
                          occupiedCells[`${displayDate}-${room}-${startSlotIdx + i}`] = true;
                        }
                      }

                      const isMySchedule =
                        exam.proctor_id === user?.user_id ||
                        (exam.proctors && exam.proctors.includes(user?.user_id || 0));

                      return (
                        <td
                          key={String(room)}
                          rowSpan={rowSpan}
                          style={{
                            border: "1px solid #e2e8f0",
                            padding: 3,
                            verticalAlign: "top",
                          }}
                        >
                          <div
                            style={{
                              background: courseColorMap[exam.course_id] || "#94a3b8",
                              color: "#fff",
                              borderRadius: 4,
                              padding: "3px 4px",
                              height: "100%",
                              outline: isMySchedule ? "2px solid #4CAF50" : "none",
                              boxShadow: isMySchedule
                                ? "0 0 8px 2px rgba(76,175,80,0.6)"
                                : "none",
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 10 }}>{exam.course_id}</div>
                            <div style={{ fontSize: 9, opacity: 0.9 }}>
                              {exam.sections?.join(", ") || exam.section_name || ""}
                            </div>
                            <div style={{ fontSize: 9, opacity: 0.8 }}>
                              {formatTo12(s)} – {formatTo12(en)}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hiddenRooms > 0 && (
            <div
              style={{
                textAlign: "center",
                marginTop: 6,
                fontSize: 10,
                color: "#64748b",
                fontStyle: "italic",
              }}
            >
              +{hiddenRooms} more room{hiddenRooms !== 1 ? "s" : ""} not shown — view full schedule in Exam Schedule
            </div>
          )}

          {/* Legend for my schedule highlight */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: "#2563EB",
                border: "2px solid #4CAF50",
                boxShadow: "0 0 5px rgba(76,175,80,0.6)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "#64748b" }}>Green outline = your assigned exam</span>
          </div>
        </>
      )}
    </div>
  );
};

export default MiniExamViewer;