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

  useEffect(() => {
    const fetchDeanName = async () => {
      if (!user?.user_id) return;

      try {
        // Get scheduler's college
        const { data: userRole, error: roleError } = await supabase
          .from("tbl_user_role")
          .select("college_id")
          .eq("user_id", user.user_id)
          .eq("role_id", 3)
          .single();

        if (roleError || !userRole) return;

        // Get dean's user_id
        const { data: deanRole, error: deanError } = await supabase
          .from("tbl_user_role")
          .select("user_id")
          .eq("college_id", userRole.college_id)
          .eq("role_id", 1)
          .single();

        if (deanError || !deanRole) return;

        // Fetch dean info
        const { data: deanData, error: userError } = await supabase
          .from("tbl_users")
          .select("first_name, last_name")
          .eq("user_id", deanRole.user_id)
          .single();

        if (userError || !deanData) {
          setDeanName("Unknown Dean");
        } else {
          setDeanName(`${deanData.first_name} ${deanData.last_name}`);
        }
      } catch (err) {
        console.error("Error fetching dean info:", err);
        setDeanName("Unknown Dean");
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

    setLoading(true);
    try {
      // Find scheduler's college
      const { data: userRole, error: roleError } = await supabase
        .from("tbl_user_role")
        .select("college_id")
        .eq("user_id", user.user_id)
        .eq("role_id", 3)
        .single();

      if (roleError || !userRole) {
        toast.error("Could not determine your college");
        return;
      }

      // Find dean for same college
      const { data: deanRole, error: deanError } = await supabase
        .from("tbl_user_role")
        .select("user_id")
        .eq("college_id", userRole.college_id)
        .eq("role_id", 1)
        .single();

      if (deanError || !deanRole) {
        toast.error("No dean found for your college");
        return;
      }

      // Prepare schedule data
      const scheduleData = {
        college_name: collegeName,
        exam_period: examPeriodName,
        term: termName,
        semester: semesterName,
        academic_year: yearName,
        building: buildingName,
        total_schedules: filteredExamData.length,
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

      const requestId = crypto.randomUUID();

      // Insert request record
      const { error: insertError } = await supabase
        .from("tbl_scheduleapproval")
        .insert({
          request_id: requestId,
          submitted_by: user.user_id,
          dean_user_id: deanRole.user_id,
          college_name: collegeName,
          schedule_data: scheduleData,
          remarks: remarks || "No remarks",
          status: "pending",
          submitted_at: new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
        });

      if (insertError) throw insertError;

      // Send dean notification
      await supabase.from("tbl_notification").insert({
        user_id: deanRole.user_id,
        sender_id: user.user_id,
        title: "New Schedule Approval Request",
        message: `${user.first_name} ${user.last_name} submitted a schedule for ${collegeName}.`,
        type: "schedule_approval",
        status: "unread",
        link_url: "/dean-requests",
        is_seen: false,
        priority: 1,
        created_at: new Date().toISOString(),
      });

      toast.success("Schedule sent to dean!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to send to dean");
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
          disabled={loading}
        >
          {loading ? "Sending..." : "Send to Dean"}
        </button>
      </div>
    </div>
  );
};

export default DeanSender;
