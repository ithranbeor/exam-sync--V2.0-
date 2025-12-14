import React, { useState, useEffect } from "react";
import { api } from '../lib/apiClient.ts';
import { toast } from "react-toastify";
import "../styles/MessageSender.css";

interface DeanSenderProps {
  onClose: () => void;
  collegeName: string;
  user: any;
  filteredExamData: any[];
  getUserName: (id: number | null | undefined) => string;
  examPeriodName: string;
  termName: string;
  semesterName: string;
  yearName: string;
  buildingName: string;
}

const DeanSender: React.FC<DeanSenderProps> = ({
  onClose,
  collegeName,
  user,
  filteredExamData,
  getUserName,
  examPeriodName,
  termName,
  semesterName,
  yearName,
  buildingName,
}) => {
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [deanName, setDeanName] = useState<string | null>(null);
  const [deanUserId, setDeanUserId] = useState<number | null>(null);

  useEffect(() => {
    const fetchDeanName = async () => {
      if (!user?.user_id) return;

      try {
        const userRoleResponse = await api.get('/tbl_user_role', {
          params: {
            user_id: user.user_id,
            role_id: 3 // Scheduler role
          }
        });

        if (!userRoleResponse.data || userRoleResponse.data.length === 0) {
          setDeanName("No College Assigned");
          return;
        }

        const schedulerCollegeId = userRoleResponse.data[0].college_id;

        // Get dean's role using the same college
        const deanRoleResponse = await api.get('/tbl_user_role', {
          params: {
            college_id: schedulerCollegeId,
            role_id: 1 // Dean role
          }
        });

        if (!deanRoleResponse.data || deanRoleResponse.data.length === 0) {
          setDeanName("No Dean Assigned");
          return;
        }

        const deanRole = deanRoleResponse.data[0];
        setDeanUserId(deanRole.user_id);

        // Fetch dean's user information
        const deanUserResponse = await api.get(`/users/${deanRole.user_id}/`);

        const deanData = deanUserResponse.data;
        setDeanName(`${deanData.first_name} ${deanData.last_name}`);

      } catch (err) {
        setDeanName("Error Loading Dean");
      }
    };

    fetchDeanName();
  }, [user]);

  const handleSendToDean = async () => {
    if (!user?.user_id) {
      toast.error("User not found");
      return;
    }
    
    // ✅ Better validation
    if (!collegeName || collegeName === "Add schedule first") {
      toast.error("College information is missing");
      return;
    }
    
    if (filteredExamData.length === 0) {
      toast.warn("No schedules to send");
      return;
    }
    
    if (!deanUserId) {
      toast.error("Dean not found for your college");
      return;
    }

    setLoading(true);
    try {
      // ✅ Validate schedule data
      const validSchedules = filteredExamData.filter(exam => 
        exam.course_id && 
        exam.exam_date && 
        exam.exam_start_time && 
        exam.exam_end_time &&
        exam.room_id
      );

      if (validSchedules.length === 0) {
        toast.error("All schedules are incomplete");
        return;
      }

      if (validSchedules.length < filteredExamData.length) {
        toast.warn(`${filteredExamData.length - validSchedules.length} incomplete schedules will be skipped`);
      }

      // Prepare schedule data
      const scheduleData = {
        user_id: user.user_id,  // ✅ Must include user_id at top level
        college_name: collegeName,
        exam_period: examPeriodName || "Not specified",
        term: termName || "Not specified",
        semester: semesterName || "Not specified",
        academic_year: yearName || "Not specified",
        building: buildingName || "Not specified",
        remarks: remarks || "No remarks",
        schedules: validSchedules.map((exam) => ({
          course_id: exam.course_id,
          // ✅ Send BOTH array and legacy format
          sections: exam.sections && exam.sections.length > 0 ? exam.sections : [exam.section_name || "N/A"],
          section_name: exam.sections && exam.sections.length > 0 
            ? exam.sections.join(', ') 
            : exam.section_name || "N/A",
          exam_date: exam.exam_date,
          exam_start_time: exam.exam_start_time,
          exam_end_time: exam.exam_end_time,
          room_id: exam.room_id,
          building_name: exam.building_name || buildingName,
          // ✅ Send BOTH array and string format for instructors
          instructors: exam.instructors && exam.instructors.length > 0 
            ? exam.instructors 
            : (exam.instructor_id ? [exam.instructor_id] : []),
          instructor: exam.instructors && exam.instructors.length > 0
            ? exam.instructors.map((id: number) => getUserName(id)).filter((n: string) => n !== '-').join(', ')
            : getUserName(exam.instructor_id),
          // ✅ Send BOTH array and string format for proctors
          proctors: exam.proctors && exam.proctors.length > 0 
            ? exam.proctors 
            : (exam.proctor_id ? [exam.proctor_id] : []),
          proctor: exam.proctors && exam.proctors.length > 0
            ? exam.proctors.map((id: number) => getUserName(id)).filter((n: string) => n !== '-').join(', ')
            : getUserName(exam.proctor_id),
        })),
      };

      // ✅ Send to backend
      const response = await api.post('/send_schedule_to_dean/', scheduleData);

      toast.success(
        `Schedule sent successfully! (${validSchedules.length} exams sent to ${response.data.dean_name || 'dean'})`
      );
      
      // Delay closing to show success message
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err: any) {
      let errorMessage = "Failed to send to dean";
      
      if (err.response?.status === 401) {
        errorMessage = "Authentication error. Please log in again.";
      } else if (err.response?.status === 404) {
        errorMessage = err.response?.data?.error || "Dean or college not found";
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="message-sender-container">
      <div className="message-sender-header">
        <h3>Send Schedule to Dean</h3>
      </div>

      <div className="message-sender-body">
        <div className="summary-box">
          <p><strong>Dean:</strong> {deanName || "Loading..."}</p>
          <p><strong>College:</strong> {collegeName}</p>
          <p><strong>Total Exams:</strong> {filteredExamData.length}</p>
          
          {/* ✅ Show warnings */}
          {filteredExamData.length === 0 && (
            <p style={{ color: 'orange', marginTop: '10px', fontSize: '14px' }}>
              ⚠️ No schedules available
            </p>
          )}
          
          {filteredExamData.length > 0 && (() => {
            const incomplete = filteredExamData.filter(exam => 
              !exam.course_id || !exam.exam_date || 
              !exam.exam_start_time || !exam.exam_end_time || !exam.room_id
            );
            if (incomplete.length > 0) {
              return (
                <p style={{ color: 'orange', marginTop: '10px', fontSize: '14px' }}>
                  ⚠️ {incomplete.length} incomplete schedule(s) will be skipped
                </p>
              );
            }
            return null;
          })()}
        </div>

        <div className="message-section" style={{ marginTop: "15px" }}>
          <label>Remarks (optional):</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add remarks for the dean..."
            rows={6}
          />
        </div>
      </div>

      <div className="message-sender-footer">
        <button type='button' onClick={onClose} className="btn-cancel">
          Cancel
        </button>
        <button 
          type='button'
          onClick={handleSendToDean}
          className="btn-send"
          disabled={loading || !deanUserId || filteredExamData.length === 0}
        >
          {loading ? "Sending..." : "Send to Dean"}
        </button>
      </div>
    </div>
  );
};

export default DeanSender;