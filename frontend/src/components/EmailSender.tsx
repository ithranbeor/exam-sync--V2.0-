import React, { useState, useEffect } from "react";
import Select from "react-select";
import { api } from '../lib/apiClient.ts';
import { toast } from "react-toastify";
import "../styles/MessageSender.css";

interface UserProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
  } | null;
}

interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  email_address: string;
}

interface ProctorSchedule {
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  room_id: string;
  building_name: string;
  course_id: string;
  section_name: string;
}

interface EmailSenderProps extends UserProps {
  onClose: () => void;
  collegeName: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
  examData?: any[];
}

const EmailSender: React.FC<EmailSenderProps> = ({ 
  onClose, 
  collegeName, 
  user,
  approvalStatus,
  examData = []
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [proctorSchedules, setProctorSchedules] = useState<Record<number, ProctorSchedule[]>>({});

  useEffect(() => {
    const fetchProctorsAndSchedules = async () => {
      try {
        if (!user?.user_id) return;

        console.log("🔍 EmailSender - Approval Status:", approvalStatus);
        console.log("📊 EmailSender - Exam Data Count:", examData?.length || 0);
        console.log("🏛️ EmailSender - College Name:", collegeName);

        if (approvalStatus === 'approved' && examData && examData.length > 0) {
          console.log("✅ Loading proctors from APPROVED schedule for college:", collegeName);
          
          // 🔒 CRITICAL: Filter exam data by scheduler's college FIRST
          const collegeExamData = examData.filter(
            exam => exam.college_name === collegeName
          );

          console.log(`🔍 Filtered to ${collegeExamData.length} exams for college: ${collegeName}`);

          if (collegeExamData.length === 0) {
            console.warn("⚠️ No exams found for this college in approved schedule");
            toast.warn(`No exams found for ${collegeName} in the approved schedule`);
            setUsers([]);
            return;
          }

          const proctorIds = Array.from(
            new Set(
              collegeExamData
                .map(exam => exam.proctor_id)
                .filter(Boolean)
            )
          ) as number[];

          console.log(`👥 Proctor IDs from ${collegeName}:`, proctorIds);

          if (proctorIds.length === 0) {
            toast.warn(`No proctors assigned in the approved schedule for ${collegeName}`);
            setUsers([]);
            return;
          }

          const usersResponse = await api.get('/users/');
          const allUsers = usersResponse.data;
          
          const proctorUsers = allUsers.filter((u: User) => 
            proctorIds.includes(u.user_id)
          );

          console.log(`✅ Found ${proctorUsers.length} proctor users for ${collegeName}:`, 
            proctorUsers.map((p: User) => `${p.first_name} ${p.last_name}`));
          setUsers(proctorUsers);

          const scheduleMap: Record<number, ProctorSchedule[]> = {};
          
          proctorUsers.forEach((proctor: User) => {
            const proctorExams = collegeExamData.filter(
              exam => exam.proctor_id === proctor.user_id
            );

            scheduleMap[proctor.user_id] = proctorExams.map(exam => ({
              exam_date: exam.exam_date,
              exam_start_time: exam.exam_start_time,
              exam_end_time: exam.exam_end_time,
              room_id: exam.room_id,
              building_name: exam.building_name,
              course_id: exam.course_id,
              section_name: exam.section_name
            }));

            console.log(`📅 ${proctor.first_name} ${proctor.last_name}: ${scheduleMap[proctor.user_id].length} exam(s) for ${collegeName}`);
          });

          setProctorSchedules(scheduleMap);

        } else {
          console.log("⚠️ Using fallback: Loading all proctors from college");
          const schedulerRolesResponse = await api.get('/tbl_user_role', {
            params: {
              user_id: user.user_id,
              role_id: 3
            }
          });

          const schedulerRoles = schedulerRolesResponse.data;
          if (!schedulerRoles || schedulerRoles.length === 0) {
            toast.error("No scheduler role found");
            return;
          }

          const schedulerColleges = schedulerRoles.map((r: any) => r.college_id).filter(Boolean);

          const proctorRolesResponse = await api.get('/tbl_user_role', {
            params: {
              role_id: 5
            }
          });

          const proctorRoles = proctorRolesResponse.data;
          const proctorIds = proctorRoles
            .filter((r: any) => schedulerColleges.includes(r.college_id))
            .map((r: any) => r.user_id);

          if (proctorIds.length === 0) {
            setUsers([]);
            toast.warn("No proctors found under your college");
            return;
          }

          const usersResponse = await api.get('/users/');
          const proctorUsers = usersResponse.data.filter((u: User) => 
            proctorIds.includes(u.user_id)
          );

          setUsers(proctorUsers || []);
        }
      } catch (err) {
        console.error("Error loading users:", err);
        toast.error("Failed to load users");
      }
    };

    fetchProctorsAndSchedules();
  }, [user, approvalStatus, examData]);

  const formatTo12Hour = (dateTimeString: string) => {
    const time = dateTimeString.slice(11, 16);
    const [hourStr, minute] = time.split(":");
    let hour = Number(hourStr);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const generateProctorEmailBody = (proctor: User): string => {
    const schedules = proctorSchedules[proctor.user_id] || [];

    const schedulerFullName = user
      ? `${user.first_name || ""} ${user.middle_name ? user.middle_name + " " : ""}${user.last_name || ""}`.trim()
      : "Scheduler";

    const schedulerEmail = user?.email_address || "";
    
    if (schedules.length === 0) {
      return `Dear ${proctor.first_name} ${proctor.last_name},\n\nYou have been assigned as a proctor for ${collegeName}.\n\n${body}`;
    }

    let emailBody = `Dear ${proctor.first_name} ${proctor.last_name},\n\n`;
    emailBody += `You have been assigned as a proctor for the following examination schedule(s) at ${collegeName}:\n\n`;
    
    schedules.forEach((schedule, index) => {
      emailBody += `${index + 1}. ${schedule.course_id} - ${schedule.section_name}\n`;
      emailBody += `   Date: ${formatDate(schedule.exam_date)}\n`;
      emailBody += `   Time: ${formatTo12Hour(schedule.exam_start_time)} - ${formatTo12Hour(schedule.exam_end_time)}\n`;
      emailBody += `   Room: ${schedule.room_id}, ${schedule.building_name}\n\n`;
    });

    if (body.trim()) {
      emailBody += `\nAdditional Message:\n${body}\n\n`;
    }

    emailBody += `Please ensure you arrive at least 15 minutes before the exam starts.\n\n`;
    emailBody +=
      `Best regards,\n` +
      `${(schedulerFullName)}\n` +
      `Scheduler, ${collegeName}\n` +
      `${schedulerEmail}`;

    return emailBody;

    return emailBody;
  };

  const handleSendEmail = async () => {
    if (selectedUsers.length === 0) {
      toast.warn("Please select at least one user");
      return;
    }

    if (!selectedUsers.every(u => u.email_address)) {
      toast.error("Some proctors don't have email addresses!");
      return;
    }

    const emailSubject = subject.trim() || 
      (approvalStatus === 'approved' 
        ? `Proctoring Assignment - ${collegeName}` 
        : "Notification from Scheduler");

    setLoading(true);

    try {
      // Prepare emails data for real Gmail sending
      const emailsData = selectedUsers.map((proctor) => {
        const personalizedBody = generateProctorEmailBody(proctor);

        console.log(`Preparing email for ${proctor.first_name} ${proctor.last_name}`);
        console.log(`   Email: ${proctor.email_address}`);
        console.log(`   Schedules: ${proctorSchedules[proctor.user_id]?.length || 0}`);

        return {
          user_id: proctor.user_id,
          email: proctor.email_address,
          name: `${proctor.first_name} ${proctor.last_name}`,
          subject: emailSubject,
          message: personalizedBody
        };
      });

      // 📧 Send real Gmail emails via backend
      console.log(`📬 Sending ${emailsData.length} real Gmail emails...`);
      
      const response = await api.post('/send-proctor-emails/', {
        emails: emailsData,
        sender_id: user?.user_id
      });

      const { sent_count, failed_emails } = response.data;

      if (sent_count > 0) {
        toast.success(`Successfully sent ${sent_count} email(s) to Gmail!`);
        console.log(`Successfully sent ${sent_count} Gmail emails`);
      }

      if (failed_emails && failed_emails.length > 0) {
        console.error("❌ Failed emails:", failed_emails);
        toast.warn(`${failed_emails.length} email(s) failed to send`);
        failed_emails.forEach((fail: any) => {
          console.error(`   - ${fail.name} (${fail.email}): ${fail.reason}`);
        });
      }

      if (sent_count === emailsData.length) {
        onClose(); // Only close if all succeeded
      }

    } catch (err: any) {
      console.error("Error sending emails:", err);
      toast.error(err?.response?.data?.error || "Failed to send emails");
    } finally {
      setLoading(false);
    }
  };

  const options = users.map(u => ({
    value: u.user_id,
    label: `${u.first_name} ${u.last_name}${u.email_address ? ` - ${u.email_address}` : " (No email)"}${
      proctorSchedules[u.user_id] 
        ? ` (${proctorSchedules[u.user_id].length} exam${proctorSchedules[u.user_id].length > 1 ? 's' : ''})` 
        : ''
    }`,
    user: u
  }));

  return (
    <div className="message-sender-container">
      <div className="message-sender-header">
        <h3>
          {approvalStatus === 'approved' 
            ? `Send Approved Schedule to Proctors` 
            : `Send Email to Proctors`}
        </h3>
        {approvalStatus === 'approved' && (
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Schedule approved - Emails will be sent to proctors.
          </p>
        )}
      </div>

      <div className="message-sender-body">
        <div className="message-section">
          <label>Select Proctors:</label>
          <Select
            options={[
              { value: "select_all", label: "- Select All -" },
              ...options
            ]}
            isMulti
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            onChange={(selectedOptions: any) => {
              if (!selectedOptions) {
                setSelectedUsers([]);
                return;
              }

              const lastSelected = selectedOptions[selectedOptions.length - 1];
              if (lastSelected?.value === "select_all") {
                if (selectedUsers.length < users.length) {
                  setSelectedUsers(users);
                } else {
                  setSelectedUsers([]);
                }
              } else {
                const filtered = selectedOptions
                  .filter((s: any) => s.value !== "select_all")
                  .map((s: any) => s.user);
                setSelectedUsers(filtered);
              }
            }}
            value={[
              ...(selectedUsers.length === users.length
                ? [{ value: "select_all", label: "- Select All -" }]
                : []),
              ...selectedUsers.map(u => ({
                value: u.user_id,
                label: `${u.first_name} ${u.last_name}${
                  u.email_address ? ` - ${u.email_address}` : " (No email)"
                }${
                  proctorSchedules[u.user_id] 
                    ? ` (${proctorSchedules[u.user_id].length} exam${proctorSchedules[u.user_id].length > 1 ? 's' : ''})` 
                    : ''
                }`,
                user: u,
              })),
            ]}
            styles={{
              valueContainer: (provided) => ({
                ...provided,
                maxHeight: "120px",
                overflowY: "auto",
              }),
            }}
          />
        </div>

        <div className="message-section">
          <label>Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={
              approvalStatus === 'approved'
                ? `Proctoring Assignment - ${collegeName}`
                : "Enter email subject..."
            }
            className="subject-input"
          />

          <label>Additional Message (Optional):</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={
              approvalStatus === 'approved'
                ? "Add any additional instructions or notes..."
                : "Enter your email content..."
            }
            rows={6}
          />
          <div className="char-count">{body.length} characters</div>
          
          {approvalStatus === 'approved' && (
            <p style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
              Note: Real Gmail emails will be sent with personalized exam schedules
            </p>
          )}
        </div>
      </div>

      <div className="message-sender-footer">
        <button type="button" onClick={onClose} className="btn-cancel">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSendEmail}
          className="btn-send"
          disabled={loading || selectedUsers.length === 0}
        >
          {loading 
            ? "Sending to Gmail..." 
            : `Send to ${selectedUsers.length} Gmail address(es)`
          }
        </button>
      </div>
    </div>
  );
};

export default EmailSender;