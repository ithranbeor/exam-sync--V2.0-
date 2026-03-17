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
    college_name?: string;
    exam_period?: string;
    exam_category?: string;
    instructor_id?: number;
    instructors?: number[];
    proctor_id?: number;
    proctors?: number[];
}

interface MiniPlotScheduleProps {
    user: {
        user_id: number;
        first_name?: string;
        last_name?: string;
    } | null;
    onOpenPlotter: () => void;
}

const MiniPlotSchedule: React.FC<MiniPlotScheduleProps> = ({ user, onOpenPlotter }) => {
    const [examData, setExamData] = useState<ExamDetail[]>([]);
    const [collegeName, setCollegeName] = useState<string>("");
    const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [logoUrls, setLogoUrls] = useState<string[]>(["/logo/USTPlogo.png"]);
    const [collegeId, setCollegeId] = useState<string>("");

    // Fetch scheduler's college (role_id 3 = scheduler)
    useEffect(() => {
        const fetchCollege = async () => {
            if (!user?.user_id) { setIsLoading(false); return; }
            try {
                // Try scheduler role first (role_id 3), then fallback to any role with college_id
                const rolesRes = await api.get("/tbl_user_role", {
                    params: { user_id: user.user_id, role_id: 3 },
                });
                let roles = rolesRes.data || [];

                if (roles.length === 0) {
                    const allRolesRes = await api.get("/tbl_user_role", { params: { user_id: user.user_id } });
                    roles = allRolesRes.data || [];
                }

                const withCollege = roles.find((r: any) => r.college_id);
                if (!withCollege) { setIsLoading(false); return; }

                setCollegeId(String(withCollege.college_id));

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

    // Fetch footer logos
    useEffect(() => {
        if (!collegeId) return;
        const fetchFooter = async () => {
            try {
                const res = await api.get("/tbl_schedule_footer/", { params: { college_id: collegeId } });
                if (res.data && res.data.length > 0) {
                    const data = res.data[0];
                    const urls =
                        data.logo_urls && data.logo_urls.length > 0
                            ? data.logo_urls
                            : data.logo_url
                                ? [data.logo_url]
                                : ["/logo/USTPlogo.png"];
                    setLogoUrls(urls);
                }
            } catch {
                // ignore
            }
        };
        fetchFooter();
    }, [collegeId]);

    // Fetch exam data
    useEffect(() => {
        if (!collegeName) return;
        const fetchExams = async () => {
            try {
                const res = await api.get("/tbl_examdetails", { params: { college_name: collegeName } });
                setExamData(res.data || []);
            } catch {
                setExamData([]);
            }
        };
        fetchExams();
        const interval = setInterval(fetchExams, 10000);
        return () => clearInterval(interval);
    }, [collegeName]);

    // Check approval status
    useEffect(() => {
        if (!collegeName) return;
        const checkApproval = async () => {
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
        checkApproval();
        const interval = setInterval(checkApproval, 10000);
        return () => clearInterval(interval);
    }, [collegeName, examData.length]);

    const displayCollege = collegeName ? `${collegeName}, USTP-CDO` : "Add schedule first";
    const termName = examData.find((e) => e.exam_category)?.exam_category ?? "-";
    const semesterName = examData.find((e) => e.semester)?.semester ?? "-";
    const yearName = examData.find((e) => e.academic_year)?.academic_year ?? "-";
    const examPeriodName = examData.find((e) => e.exam_period)?.exam_period ?? "-";
    const hasData = examData.length > 0;

    // Color map for exam boxes
    const colors = [
        "#DC2626", "#D97706", "#059669", "#0891B2", "#2563EB",
        "#7C3AED", "#DB2777", "#EA580C", "#0D9488", "#65A30D",
    ];
    const courseColorMap: Record<string, string> = {};
    let ci = 0;
    examData.forEach((e) => {
        if (e.course_id && !courseColorMap[e.course_id]) {
            courseColorMap[e.course_id] = colors[ci % colors.length];
            ci++;
        }
    });

    // Show a compact preview of exam boxes for today or nearest date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingDates = Array.from(new Set(examData.map((e) => e.exam_date).filter(Boolean)))
        .sort()
        .filter((d) => new Date(d!) >= today);
    const displayDate =
        upcomingDates[0] ||
        Array.from(new Set(examData.map((e) => e.exam_date).filter(Boolean)))
            .sort()
            .slice(-1)[0];

    const dateExams = examData.filter((e) => e.exam_date === displayDate).slice(0, 8);

    // Shared header — mirrors S_ExamViewer exactly
    const Header = () => (
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                {logoUrls.map((url, idx) => (
                    <img key={idx} src={url} alt={`Logo ${idx + 1}`} style={{ width: 50, height: 40, objectFit: "contain" }} />
                ))}
            </div>
            <div style={{ fontSize: 10, color: "#333", fontFamily: "serif", fontWeight: 700, lineHeight: 1.3 }}>
                University of Science and Technology of Southern Philippines
            </div>
            <div style={{ fontSize: 8, color: "#666", fontFamily: "serif", marginBottom: 2 }}>
                Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
            </div>
            <div style={{ fontSize: 12, color: "#092C4C", fontFamily: "serif", fontWeight: 700 }}>
                {displayCollege}
            </div>
            <div style={{ fontSize: 10, color: "#333", fontFamily: "serif", fontWeight: 600 }}>
                {hasData
                    ? `${termName} Examination Schedule | ${semesterName} Semester | A.Y. ${yearName}`
                    : "Examination Schedule"}
            </div>
            {hasData && examPeriodName !== "-" && (
                <div style={{ fontSize: 9, color: "#555", fontFamily: "serif" }}>{examPeriodName}</div>
            )}
            <hr style={{ margin: "6px 0 0" }} />
        </div>
    );

    if (isLoading) {
        return (
            <div
                onClick={onOpenPlotter}
                style={{
                    background: "#f9f9f9",
                    borderRadius: 12,
                    border: "1.5px solid #e2e8f0",
                    padding: 16,
                    minHeight: 220,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#92a3b8",
                    fontSize: 13,
                    cursor: "pointer",
                }}
            >
                Loading schedule...
            </div>
        );
    }

    return (
        <div
            style={{ position: "relative", cursor: "pointer" }}
            onClick={onOpenPlotter}
        >
            {/* Approval status badge */}
            {approvalStatus && (
                <div
                    style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 2,
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#fff",
                        background:
                            approvalStatus === "approved"
                                ? "#4CAF50"
                                : approvalStatus === "rejected"
                                    ? "#ef4444"
                                    : "#f59e0b",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        pointerEvents: "none",
                    }}
                >
                    {approvalStatus.toUpperCase()}
                </div>
            )}

            {/* Main card — mirrors the empty/data card from S_ExamViewer */}
            <div
                style={{
                    background: "#f9f9f9",
                    borderRadius: 12,
                    border: "1.5px solid #e2e8f0",
                    padding: "12px 14px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    transition: "box-shadow 0.2s, transform 0.2s",
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(9,44,76,0.15)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                }}
            >
                <Header />

                {/* Body — empty state OR mini exam box preview */}
                {!hasData ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "28px 10px",
                            fontSize: 14,
                            color: "#999",
                            fontFamily: "serif",
                        }}
                    >
                        Add schedule first
                    </div>
                ) : (
                    <>
                        {/* Date label */}
                        <div
                            style={{
                                background: "#092C4C",
                                color: "#fff",
                                borderRadius: 6,
                                padding: "3px 8px",
                                fontSize: 10,
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
                                : ""}
                            {upcomingDates.length > 1 && (
                                <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 9, opacity: 0.8 }}>
                                    (+{upcomingDates.length - 1} more)
                                </span>
                            )}
                        </div>

                        {/* Exam boxes — same colored cards as S_ExamViewer */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                                gap: 6,
                            }}
                        >
                            {dateExams.map((exam) => {
                                const s = exam.exam_start_time?.slice(11, 16) ?? "";
                                const en = exam.exam_end_time?.slice(11, 16) ?? "";
                                const fmt = (t: string) => {
                                    if (!t) return "";
                                    const [h, m] = t.split(":").map(Number);
                                    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
                                };
                                const sections =
                                    exam.sections && exam.sections.length > 0
                                        ? exam.sections.slice(0, 2).join(", ") +
                                        (exam.sections.length > 2 ? "…" : "")
                                        : exam.section_name || "";

                                return (
                                    <div
                                        key={exam.examdetails_id}
                                        style={{
                                            background: courseColorMap[exam.course_id] || "#9CA3AF",
                                            color: "#fff",
                                            borderRadius: 6,
                                            padding: "5px 7px",
                                            fontSize: 10,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        <div style={{ fontWeight: 700, fontSize: 11 }}>{exam.course_id}</div>
                                        <div style={{ fontSize: 9, opacity: 0.9 }}>{sections}</div>
                                        <div style={{ fontSize: 9, opacity: 0.8 }}>Room {exam.room_id}</div>
                                        <div style={{ fontSize: 9, opacity: 0.8 }}>
                                            {fmt(s)} – {fmt(en)}
                                        </div>
                                    </div>
                                );
                            })}

                            {examData.length > 8 && (
                                <div
                                    style={{
                                        background: "#e2e8f0",
                                        color: "#64748b",
                                        borderRadius: 6,
                                        padding: "5px 7px",
                                        fontSize: 10,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontStyle: "italic",
                                    }}
                                >
                                    +{examData.length - 8} more
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Bottom CTA — always visible */}
                <div
                    style={{
                        marginTop: 12,
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: 10,
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#092C4C",
                            background: "rgba(9,44,76,0.08)",
                            padding: "4px 12px",
                            borderRadius: 20,
                        }}
                    >
                        Open Plotter →
                    </span>
                </div>
            </div>
        </div>
    );
};

export default MiniPlotSchedule;