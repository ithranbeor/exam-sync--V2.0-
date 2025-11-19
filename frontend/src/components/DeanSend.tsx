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
      console.log("📤 Sending schedule to dean...");

      // Prepare schedule data
      const scheduleData = {
        college_name: collegeName,
        exam_period: examPeriodName,
        term: termName,
        semester: semesterName,
        academic_year: yearName,
        building: buildingName,
        remarks: remarks || "No remarks",
        schedules: filteredExamData.map((exam) => ({
          course_id: exam.course_id,
          section_name: exam.section_name,
          exam_date: exam.exam_date,
          exam_start_time: exam.exam_start_time,
          exam_end_time: exam.exam_end_time,
          room_id: exam.room_id,
          instructor: getUserName(exam.instructor_id),
          proctor: getUserName(exam.proctor_id),
        })),
      };

      console.log("📦 Schedule payload:", {
        user_id: user.user_id,
        dean_user_id: deanUserId,
        college_name: collegeName,
        total_schedules: scheduleData.schedules.length
      });

      // Send to backend endpoint
      const response = await api.post('/send_schedule_to_dean/', {
        user_id: user.user_id,
        ...scheduleData
      });

      console.log("✅ Response:", response.data);

      toast.success("Schedule sent to dean successfully!");
      onClose();
    } catch (err: any) {
      console.error("❌ Error sending to dean:", err);
      console.error("Error response:", err.response?.data);
      toast.error(err.response?.data?.error || "Failed to send to dean");
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
        <button type='button' onClick={onClose} className="btn-cancel">Cancel</button>
        <button type='button'
          onClick={handleSendToDean}
          className="btn-send"
          disabled={loading || !deanUserId}
        >
          {loading ? "Sending..." : "Send to Dean"}
        </button>
      </div>
    </div>
  );
};

export default DeanSender;