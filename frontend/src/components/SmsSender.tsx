import React, { useState, useEffect } from "react";
import Select from "react-select";
import { api } from '../lib/apiClient.ts';
import { toast } from "react-toastify";
import "../styles/MessageSender.css";

interface UserProps {
  user: {
    user_id: number;
    contact_number?: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
  } | null;
}

interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  contact_number?: string;
}

interface SmsSenderProps extends UserProps {
  onClose: () => void;
  collegeName: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
  examData?: any[];
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

const SmsSender: React.FC<SmsSenderProps> = ({ 
  onClose, 
  collegeName, 
  user,
  approvalStatus,
  examData = []
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [proctorSchedules, setProctorSchedules] = useState<Record<number, ProctorSchedule[]>>({});

  useEffect(() => {
    const fetchProctorsAndSchedules = async () => {
      try {
        if (!user?.user_id) return;

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
  }, [user, approvalStatus, examData, collegeName]);

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
      month: "short",
      day: "numeric"
    });
  };

  const generateProctorSmsBody = (proctor: User): string => {
    const schedules = proctorSchedules[proctor.user_id] || [];

    const schedulerFullName = user
      ? `${user.first_name || ""} ${user.middle_name ? user.middle_name + " " : ""}${user.last_name || ""}`.trim()
      : "Scheduler";
    
    if (schedules.length === 0) {
      // Generic message if no schedules
      let smsBody = `Hi ${proctor.first_name},\n\n`;
      smsBody += `You have been assigned as a proctor for ${collegeName}.\n\n`;
      if (message.trim()) {
        smsBody += `${message}\n\n`;
      }
      smsBody += `- ${schedulerFullName}`;
      return smsBody;
    }

    // Personalized message with schedule details
    let smsBody = `Hi ${proctor.first_name},\n\n`;
    smsBody += `You are assigned as proctor for:\n\n`;
    
    schedules.forEach((schedule, index) => {
      smsBody += `${index + 1}. ${schedule.course_id}-${schedule.section_name}\n`;
      smsBody += `${formatDate(schedule.exam_date)}, ${formatTo12Hour(schedule.exam_start_time)}-${formatTo12Hour(schedule.exam_end_time)}\n`;
      smsBody += `Room: ${schedule.room_id}, ${schedule.building_name}\n\n`;
    });

    if (message.trim()) {
      smsBody += `Note: ${message}\n\n`;
    }

    smsBody += `Please arrive 15 mins early.\n\n- ${schedulerFullName}, ${collegeName}`;

    return smsBody;
  };

  const handleSendSms = async () => {
    if (selectedUsers.length === 0) {
      toast.warn("Please select at least one user");
      return;
    }

    // Check if selected users have contact numbers
    const usersWithoutNumbers = selectedUsers.filter(u => !u.contact_number);
    if (usersWithoutNumbers.length > 0) {
      toast.error(`${usersWithoutNumbers.length} proctor(s) don't have contact numbers!`);
      return;
    }

    setLoading(true);

    try {
      // Prepare SMS data for real ITExmo sending
      const smsData = selectedUsers.map((proctor) => {
        const personalizedMessage = generateProctorSmsBody(proctor);

        console.log(`Preparing SMS for ${proctor.first_name} ${proctor.last_name}`);
        console.log(`   Number: ${proctor.contact_number}`);
        console.log(`   Schedules: ${proctorSchedules[proctor.user_id]?.length || 0}`);
        console.log(`   Message length: ${personalizedMessage.length} chars`);

        return {
          user_id: proctor.user_id,
          contact_number: proctor.contact_number,
          name: `${proctor.first_name} ${proctor.last_name}`,
          message: personalizedMessage
        };
      });

      // 📱 Send real SMS via ITExmo API through backend
      console.log(`📬 Sending ${smsData.length} real SMS messages...`);
      
      const response = await api.post('/send-proctor-sms/', {
        sms_list: smsData,
        sender_id: user?.user_id
      });

      const { sent_count, failed_sms } = response.data;

      if (sent_count > 0) {
        toast.success(`Successfully sent ${sent_count} SMS message(s)!`);
        console.log(`✅ Successfully sent ${sent_count} SMS messages`);
      }

      if (failed_sms && failed_sms.length > 0) {
        console.error("❌ Failed SMS:", failed_sms);
        toast.warn(`${failed_sms.length} SMS message(s) failed to send`);
        failed_sms.forEach((fail: any) => {
          console.error(`   - ${fail.name} (${fail.contact_number}): ${fail.reason}`);
        });
      }

      if (sent_count === smsData.length) {
        onClose(); // Only close if all succeeded
      }

    } catch (err: any) {
      console.error("Error sending SMS:", err);
      toast.error(err?.response?.data?.error || "Failed to send SMS messages");
    } finally {
      setLoading(false);
    }
  };

  const options = users.map(u => ({
    value: u.user_id,
    label: `${u.first_name} ${u.last_name}${
      u.contact_number ? ` - ${u.contact_number}` : " (No number)"
    }${
      proctorSchedules[u.user_id] 
        ? ` (${proctorSchedules[u.user_id].length} exam${proctorSchedules[u.user_id].length > 1 ? 's' : ''})` 
        : ''
    }`,
    user: u,
  }));

  return (
    <div className="message-sender-container">
      <div className="message-sender-header">
        <h3>
          {approvalStatus === 'approved' 
            ? `Send Approved Schedule via SMS` 
            : `Send SMS to Proctors`}
        </h3>
        {approvalStatus === 'approved' && (
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Schedule approved - SMS will be sent to proctors with their exam schedules.
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
              ...(selectedUsers.length === users.length && users.length > 0
                ? [{ value: "select_all", label: "- Select All -" }]
                : []),
              ...selectedUsers.map(u => ({
                value: u.user_id,
                label: `${u.first_name} ${u.last_name}${
                  u.contact_number ? ` - ${u.contact_number}` : " (No number)"
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
          <label>Additional Message (Optional):</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={
              approvalStatus === 'approved'
                ? "Add any additional instructions or notes..."
                : "Enter your SMS message here..."
            }
            rows={6}
            maxLength={320}
          />
          <div className="char-count">{message.length}/320 characters</div>
          
          {approvalStatus === 'approved' && (
            <p style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
              Note: Real SMS will be sent via ITExmo with personalized exam schedules
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
          onClick={handleSendSms}
          className="btn-send"
          disabled={loading || selectedUsers.length === 0}
        >
          {loading 
            ? "Sending SMS..." 
            : `Send SMS to ${selectedUsers.length} proctor(s)`
          }
        </button>
      </div>
    </div>
  );
};

export default SmsSender;