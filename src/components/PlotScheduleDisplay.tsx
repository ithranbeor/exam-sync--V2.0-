// PlotBondpaper.tsx
import React from "react";
import { FiRefreshCw } from "react-icons/fi";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

interface Props {
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  formData: any;
  supabase: any;
  toast: any;
  examPeriods: any[];
  roomPages: any[];
  examDetails: any[];
  setExamDetails: React.Dispatch<React.SetStateAction<any[]>>;
  isReassigning: boolean;
  sectionCourses: any[];
  instructors: any[];
  selectedProctors: Record<string, string>;
  setSelectedProctors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getInstructorName: (course_id: string, program_id: string) => string;
  getYearLevelForModality: (ed: any) => string;
}

const PlotScheduleDisplay: React.FC<Props> = ({
  page,
  totalPages,
  setPage,
  formData,
  supabase,
  toast,
  examPeriods,
  roomPages,
  examDetails,
  setExamDetails,
  isReassigning,
  sectionCourses,
  instructors,
  selectedProctors,
  setSelectedProctors,
  getInstructorName,
  getYearLevelForModality,
}) => {
  // everything from your markup goes here 👇
  return (
    <div className="plot-bondpaper">
      <div
        id={`schedule-page-${page}`}
        className="plot-grid export-section"
        style={{ flex: 2 }}
      >
        {/* Refresh Button */}
        <div
          className="refresh-container no-export"
          style={{ textAlign: "right", marginBottom: "10px" }}
        >
          <button
            type="button"
            onClick={async () => {
              if (!formData.days_period_id) return;
              try {
                const { data: updatedSchedules, error } = await supabase
                  .from("tbl_examdetails")
                  .select("*")
                  .eq("exam_date", formData.days_period_id);

                if (error) throw error;

                setExamDetails((prev) => {
                  const otherDays = prev.filter(
                    (ed) => ed.exam_date !== formData.days_period_id
                  );
                  return [...otherDays, ...(updatedSchedules || [])];
                });

                toast.success("Schedules refreshed!");
              } catch (err: any) {
                console.error(err);
                toast.error(`Failed to refresh schedules. ${err.message}`);
              }
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "20px",
              fontWeight: "bold",
              color: "#092C4C",
            }}
            title="Refresh"
          >
            <FiRefreshCw />
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <img
                src="/USTPlogo.png"
                alt="School Logo"
                style={{ width: '130px', height: '95px', marginBottom: '-8px', fontFamily: 'serif' }}
            />
            <div style={{ fontSize: '20px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
                University of Science and Technology of Southern Philippines
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '-8px', fontFamily: 'serif' }}>
                Alubijid | Balubal |Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
            </div>
            <div style={{ fontSize: '14px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
                {(() => {
                const selected = examPeriods.find(
                    (ep) => ep.examperiod_id === parseInt(formData.examperiod_id)
                );
                if (!selected) return null;

                const matchingGroup = examPeriods.filter(
                    (ep) =>
                    ep.academic_year === selected.academic_year &&
                    ep.exam_category === selected.exam_category &&
                    ep.term.term_name === selected.term.term_name &&
                    ep.college_id === selected.college_id
                );

                const sortedDates = matchingGroup
                    .map((ep) => ({
                    start: new Date(ep.start_date),
                    end: new Date(ep.end_date),
                    }))
                    .sort((a, b) => a.start.getTime() - b.start.getTime());

                const formatShortDate = (date: Date) =>
                    date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    });

                const earliest = sortedDates[0];
                const latest = sortedDates[sortedDates.length - 1];

                return (
                    <>
                    <div style={{ fontSize: '20px', color: '#333', marginBottom: '-8px' , fontFamily: 'serif' }}>{selected.college?.college_name || 'College Name'}</div>
                    <div><strong>{selected.exam_category} Examination Schedule | {selected.term?.term_name} S.Y. {selected.academic_year}</strong></div>
                    <div>{formatShortDate(earliest.start)} – {formatShortDate(latest.end)}</div>
                    </>
                );
                })()}
            </div>
            </div>

            {roomPages.length > 0 && roomPages[page] ? (
            <>
                <table>
                <thead>
                    {/* Exam Date Row */}
                    <tr>
                    <th></th>
                    <th colSpan={roomPages[page].length} style={{ textAlign: 'center' }}>
                        {formData.exam_date
                        ? new Date(formData.exam_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            })
                        : 'Date: N/A'}
                    </th>
                    </tr>

                    {/* Building Groups Row */}
                    <tr>
                    <th></th>
                    {(() => {
                        const buildingGroups: Record<string, any[]> = {};

                        // Group rooms by building
                        roomPages[page].forEach((room: any) => {
                        const buildingId = room.building?.building_id || "unknown";
                        if (!buildingGroups[buildingId]) buildingGroups[buildingId] = [];
                        buildingGroups[buildingId].push(room);
                        });

                        // Helper: parse room_id into numeric building + room
                        const parseRoom = (id: string) => {
                        const [building, room] = id.split("-").map(Number);
                        return { building, room };
                        };

                        // Sort buildings by building name (optional)
                        return Object.entries(buildingGroups)
                        .sort((a, b) => {
                            const nameA = a[1][0]?.building?.building_name || "";
                            const nameB = b[1][0]?.building?.building_name || "";
                            return nameA.localeCompare(nameB);
                        })
                        .map(([buildingId, roomsInBuilding]) => {
                            // Sort rooms numerically
                            roomsInBuilding.sort((a, b) => {
                            const A = parseRoom(a.room_id || "0-0");
                            const B = parseRoom(b.room_id || "0-0");
                            if (A.building !== B.building) return A.building - B.building;
                            return A.room - B.room;
                            });

                            return (
                            <th
                                key={buildingId}
                                colSpan={roomsInBuilding.length}
                                style={{ textAlign: "center" }}
                            >
                                {roomsInBuilding[0].building?.building_name || "Unknown"} (
                                {buildingId})
                            </th>
                            );
                        });
                    })()}
                    </tr>

                    {/* Room IDs Row */}
                    <tr>
                    <th>Time</th>
                    {(() => {
                        // Flatten + sort all rooms on this page
                        const sortedRooms = [...roomPages[page]].sort((a, b) => {
                        const parseRoom = (id: string) => {
                            const [building, room] = id.split("-").map(Number);
                            return { building, room };
                        };
                        const A = parseRoom(a.room_id || "0-0");
                        const B = parseRoom(b.room_id || "0-0");
                        if (A.building !== B.building) return A.building - B.building;
                        return A.room - B.room;
                        });

                        return sortedRooms.map((room) => (
                        <th key={room.room_id}>{room.room_id}</th>
                        ));
                    })()}
                    </tr>
                </thead>

                <tbody>
                    {(() => {
                    const cellOccupied: Record<string, boolean> = {};
                    const formatTime12Hour = (date: Date) =>
                        date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                        });

                    const times = [
                        "07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
                        "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00",
                        "16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"
                    ];

                    // Helper to parse room_id for sorting
                    const parseRoom = (id: string) => {
                        const [building, room] = id.split("-").map(Number);
                        return { building, room };
                    };

                    // Sort rooms once for this page
                    const sortedRooms = [...roomPages[page]].sort((a, b) => {
                        const A = parseRoom(a.room_id || "0-0");
                        const B = parseRoom(b.room_id || "0-0");
                        if (A.building !== B.building) return A.building - B.building;
                        return A.room - B.room;
                    });

                    return times.map((start, rowIdx) => {
                        const currentSlot = new Date(`2023-01-01T${start}:00`);
                        const end = new Date(currentSlot.getTime() + 30 * 60000);

                        return (
                        <tr key={rowIdx}>
                            <td>{`${formatTime12Hour(currentSlot)} - ${formatTime12Hour(end)}`}</td>
                            {sortedRooms.map((room) => {
                            const cellKey = `${room.room_id}-${rowIdx}`;
                            if (cellOccupied[cellKey]) return null;

                            const matchingDetails = examDetails.filter((ed) => {
                                const edStart = new Date(ed.exam_start_time);
                                return (
                                ed.room_id === room.room_id &&
                                edStart.toTimeString().slice(0, 5) === currentSlot.toTimeString().slice(0, 5) &&
                                edStart.toDateString() === new Date(formData.exam_date).toDateString()
                                );
                            });

                            if (matchingDetails.length === 0) {
                                return (
                                <td
                                    key={cellKey}
                                    style={{
                                    minHeight: "28px",
                                    border: "1px solid #ccc",
                                    backgroundColor: "#fff",
                                    }}
                                />
                                );
                            }

                            const edStart = new Date(matchingDetails[0].exam_start_time);
                            const edEnd = new Date(matchingDetails[0].exam_end_time);
                            const durationMinutes = (edEnd.getTime() - edStart.getTime()) / (1000 * 60);
                            const rowSpan = Math.ceil(durationMinutes / 30);

                            for (let i = 1; i < rowSpan; i++) {
                                cellOccupied[`${room.room_id}-${rowIdx + i}`] = true;
                            }

                            return (
                                <td
                                key={cellKey}
                                rowSpan={rowSpan}
                                style={{
                                    verticalAlign: "top",
                                    padding: "3px",
                                    minHeight: `${rowSpan * 28}px`,
                                    backgroundColor: "#f9f9f9",
                                    border: "1px solid #ccc",
                                }}
                                >
                                {matchingDetails.map((detail, idx) => {
                                    const edStart = new Date(detail.exam_start_time);

                                    // Compute available rooms dynamically for swapping
                                    const availableRooms: string[] = examDetails
                                    .filter((ed) => {
                                        const sameTime = new Date(ed.exam_start_time).getTime() === edStart.getTime();
                                        const sameCourse = ed.course_id === detail.course_id;
                                        const sameProgram = ed.program_id === detail.program_id;
                                        const sameYear = getYearLevelForModality(ed as any) === getYearLevelForModality(detail as any);
                                        return sameTime && sameCourse && sameProgram && sameYear && ed.room_id !== detail.room_id;
                                    })
                                    .map((ed) => ed.room_id);

                                    const courseColor = (courseId: string) => {
                                    const colors = [
                                        "#ffcccc","#ccffcc","#ccccff","#fff0b3","#d9b3ff",
                                        "#ffb3b3","#b3e0ff","#ffd9b3","#c2f0c2","#f0b3ff",
                                        "#ffe0cc","#e0ffcc","#cce0ff","#f0fff0","#ffe6f0",
                                        "#ffd9b3","#b3ffd9","#d9b3ff","#ffb3d9","#b3d9ff",
                                        "#e6ffe6","#ffe6e6","#e6e6ff","#fff0e6","#f0e6ff",
                                        "#ccffeb","#ffccf2","#ccf2ff","#f2ffcc","#f2ccff",
                                        "#e6ffcc","#cce6ff","#ffe6cc","#ccffe6","#e6ccff",
                                        "#ffd1b3","#b3ffd1","#d1b3ff","#ffb3d1","#b3d1ff",
                                        "#ffe0b3","#b3ffe0","#e0b3ff","#ffb3e0","#b3e0ff",
                                        "#f0ffe6","#e6f0ff","#fff0cc","#ccfff0","#f0ccff",
                                        "#ffe6f0","#f0ffe6","#e6f0ff","#ccffe6","#e6ccff",
                                        "#ffccb3","#b3ffcc","#ccb3ff","#ffb3cc","#b3ccff",
                                        "#ffd1cc","#ccd1ff","#ffccd1","#d1ffcc","#ccffd1",
                                        "#e6ffd9","#d9e6ff","#ffe6d9","#d9ffe6","#e6d9ff",
                                        "#f0d9ff","#d9fff0","#ffd9f0","#d9f0ff","#f0ffd9",
                                        "#ccf2d9","#d9ccf2","#f2d9cc","#ccf2f0","#f0ccf2"
                                    ];
                                    const hash = [...courseId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                    return colors[hash % colors.length];
                                    };

                                    return (
                                    <div
                                        key={idx}
                                        style={{
                                        height: "150px",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        backgroundColor: courseColor(detail.course_id),
                                        border: "1px solid #888",
                                        padding: "3px",
                                        fontSize: "12px",
                                        borderRadius: "6px",
                                        lineHeight: "1.4",
                                        color: "#333",
                                        boxSizing: "border-box",
                                        marginBottom: "0px",
                                        }}
                                    >
                                        <div>
                                        <strong></strong>
                                        </div>

                                        <div>
                                        {" "}
                                        {isReassigning ? ( // <-- show dropdown only when reassigning
                                            <select
                                            className="custom-select"
                                            value={detail.room_id}
                                            onChange={async (e) => {
                                                const newRoomId = e.target.value;
                                                if (!availableRooms.includes(newRoomId)) return;

                                                const swapDetail = examDetails.find(
                                                (ed) =>
                                                    ed.room_id === newRoomId &&
                                                    new Date(ed.exam_start_time).getTime() === new Date(detail.exam_start_time).getTime() &&
                                                    ed.course_id === detail.course_id &&
                                                    ed.program_id === detail.program_id &&
                                                    getYearLevelForModality(ed as any) === getYearLevelForModality(detail as any)
                                                );
                                                if (!swapDetail) return;

                                                // Update the local state first
                                                setExamDetails((prev) =>
                                                prev.map((ed) => {
                                                    if (ed.examdetails_id === detail.examdetails_id) return { ...ed, room_id: newRoomId };
                                                    if (ed.examdetails_id === swapDetail.examdetails_id) return { ...ed, room_id: detail.room_id };
                                                    return ed;
                                                })
                                                );

                                                // ✅ Update in Supabase using .update() instead of .upsert()
                                                const { error: error1 } = await supabase
                                                .from("tbl_examdetails")
                                                .update({ room_id: newRoomId })
                                                .eq("examdetails_id", detail.examdetails_id);

                                                const { error: error2 } = await supabase
                                                .from("tbl_examdetails")
                                                .update({ room_id: detail.room_id })
                                                .eq("examdetails_id", swapDetail.examdetails_id);

                                                if (error1 || error2) toast.error("Failed to swap rooms: " + (error1?.message || error2?.message));
                                                else toast.success("Rooms swapped successfully!");
                                            }}
                                            >
                                            <option value={detail.room_id}>{detail.room_id}</option>
                                            {availableRooms.map((rId: string) => (
                                                <option key={rId} value={rId}>{rId}</option>
                                            ))}
                                            </select>
                                        ) : (
                                            <strong></strong> // show room as text when not reassigning
                                        )}
                                        </div>

                                        <div><strong>{detail.course_id}</strong></div>
                                        <div><strong>{detail.section_name ?? "—"}</strong></div>
                                        <div><strong>Instructor: {getInstructorName(detail.course_id, detail.program_id)}</strong></div>

                                        <div>
                                        <strong>Proctor:</strong>{" "}
                                        {isReassigning ? (
                                            <select
                                            className="custom-select"
                                            value={selectedProctors[detail.examdetails_id] || detail.user_id || ""}
                                            onChange={(e) =>
                                                setSelectedProctors((prev) => ({
                                                ...prev,
                                                [detail.examdetails_id]: e.target.value,
                                                }))
                                            }
                                            >
                                            <option value="">Select Proctor</option>
                                            {(() => {
                                                const sectionInstructorId = sectionCourses.find(
                                                (s) =>
                                                    s.course_id === detail.course_id &&
                                                    s.program_id === detail.program_id &&
                                                    s.section_name?.trim().toLowerCase() === detail.section_name?.trim().toLowerCase()
                                                )?.user_id;

                                                const candidates = instructors.filter(
                                                (instr) =>
                                                    sectionCourses.some(
                                                    (s) =>
                                                        s.course_id === detail.course_id &&
                                                        s.program_id === detail.program_id &&
                                                        s.user_id === instr.user_id
                                                    ) &&
                                                    instr.user_id !== sectionInstructorId
                                                );

                                                return (
                                                <>
                                                    {candidates.map((instr) => (
                                                    <option key={instr.user_id} value={instr.user_id}>
                                                        {instr.first_name} {instr.last_name}
                                                    </option>
                                                    ))}
                                                    {candidates.length === 0 && sectionInstructorId && (
                                                    <option value={sectionInstructorId}>
                                                        {instructors.find((i) => i.user_id === sectionInstructorId)?.first_name}{" "}
                                                        {instructors.find((i) => i.user_id === sectionInstructorId)?.last_name} (Own Section)
                                                    </option>
                                                    )}
                                                </>
                                                );
                                            })()}
                                            </select>
                                        ) : (
                                            (() => {
                                            const proctor =
                                                instructors.find((p) => String(p.user_id) === String(detail.user_id)) ||
                                                instructors.find((instr) =>
                                                sectionCourses.some(
                                                    (s) =>
                                                    s.course_id === detail.course_id &&
                                                    s.program_id === detail.program_id &&
                                                    s.user_id === instr.user_id
                                                )
                                                );
                                            return proctor ? `${proctor.first_name} ${proctor.last_name}` : "No proctor";
                                            })()
                                        )}
                                        </div>

                                        <div style={{ fontSize: "11px", marginTop: "4px", fontStyle: "italic" }}>
                                        {formatTime12Hour(new Date(detail.exam_start_time))} -{" "}
                                        {formatTime12Hour(new Date(detail.exam_end_time))}
                                        </div>
                                    </div>
                                    );
                                })}
                                </td>
                            );
                            })}
                        </tr>
                        );
                    });
                    })()}
                </tbody>
                </table>
                <div className="pagination-container">
                {/* Previous Button */}
                <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(p - 1, 0))}
                    disabled={page === 0}
                    className={`pagination-btn ${page === 0 ? "disabled" : ""}`}
                >
                    <FaChevronLeft className="icon" />
                </button>

                {/* Page Info */}
                <span className="pagination-info">
                    Page {page + 1} of {totalPages}
                </span>

                {/* Next Button */}
                <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                    disabled={page === totalPages - 1}
                    className={`pagination-btn ${page === totalPages - 1 ? "disabled" : ""}`}
                >
                    <FaChevronRight className="icon" />
                </button>
                </div>
            </>
            ) : (
            <div style={{ textAlign: "center", marginTop: "20px", color: '#000000ff'}}>
                No schedules available or select a day period to view or generate schedules.
            </div>
            )}
      </div>
    </div>
  );
};

export default PlotScheduleDisplay;
