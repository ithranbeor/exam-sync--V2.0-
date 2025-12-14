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
        console.log("🔍 Fetching dean for user:", user.user_id);

        // Get scheduler's college using tbl_user_role
        const userRoleResponse = await api.get('/tbl_user_role', {
          params: {
            user_id: user.user_id,
            role_id: 3 // Scheduler role
          }
        });

        console.log("📋 Scheduler roles:", userRoleResponse.data);

        if (!userRoleResponse.data || userRoleResponse.data.length === 0) {
          console.error("❌ No scheduler role found");
          setDeanName("No College Assigned");
          return;
        }

        const schedulerCollegeId = userRoleResponse.data[0].college_id;
        console.log("🏛️ Scheduler's college ID:", schedulerCollegeId);

        // Get dean's role using the same college
        const deanRoleResponse = await api.get('/tbl_user_role', {
          params: {
            college_id: schedulerCollegeId,
            role_id: 1 // Dean role
          }
        });

        console.log("👔 Dean roles:", deanRoleResponse.data);

        if (!deanRoleResponse.data || deanRoleResponse.data.length === 0) {
          console.error("❌ No dean found for college");
          setDeanName("No Dean Assigned");
          return;
        }

        const deanRole = deanRoleResponse.data[0];
        setDeanUserId(deanRole.user_id);

        // Fetch dean's user information
        const deanUserResponse = await api.get(`/users/${deanRole.user_id}/`);
        console.log("👤 Dean user data:", deanUserResponse.data);

        const deanData = deanUserResponse.data;
        setDeanName(`${deanData.first_name} ${deanData.last_name}`);

      } catch (err) {
        console.error("❌ Error fetching dean info:", err);
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

      console.log("📦 Payload:", {
        user_id: scheduleData.user_id,
        college_name: scheduleData.college_name,
        total_schedules: scheduleData.schedules.length,
        first_schedule: scheduleData.schedules[0]
      });

      // ✅ Send to backend
      const response = await api.post('/send_schedule_to_dean/', scheduleData);

      console.log("✅ Response:", response.data);

      toast.success(
        `Schedule sent successfully! (${validSchedules.length} exams sent to ${response.data.dean_name || 'dean'})`
      );
      
      // Delay closing to show success message
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err: any) {
      console.error("❌ Error sending to dean:", err);
      console.error("❌ Error response:", err.response?.data);
      console.error("❌ Error status:", err.response?.status);
      
      // ✅ Better error messages
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