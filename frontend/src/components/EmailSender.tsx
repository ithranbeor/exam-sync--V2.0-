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

interface EmailSenderProps extends UserProps {
  onClose: () => void;
  collegeName: string;
}

const EmailSender: React.FC<EmailSenderProps> = ({ onClose, collegeName, user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [deanName, setDeanName] = useState<string>("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        if (!user?.user_id) return;

        // Step 1: Get scheduler's college(s)
        const { data: schedulerRoles, error: schedulerError } = await supabase
          .from("tbl_user_role")
          .select("college_id")
          .eq("user_id", user.user_id)
          .eq("role_id", 3);

        if (schedulerError || !schedulerRoles?.length) {
          toast.error("Failed to find scheduler college");
          return;
        }

        const schedulerColleges = schedulerRoles.map(r => r.college_id).filter(Boolean);

        // Step 2: Get proctors under same college(s)
        const { data: proctorRoles, error: proctorRoleError } = await supabase
          .from("tbl_user_role")
          .select("user_id")
          .in("college_id", schedulerColleges)
          .eq("role_id", 5);

        if (proctorRoleError || !proctorRoles?.length) {
          setUsers([]);
          toast.warn("No proctors found under your college");
          return;
        }

        const proctorIds = proctorRoles.map(r => r.user_id);

        // Step 3: Fetch proctor details
        const { data: proctorUsers, error: proctorUserError } = await supabase
          .from("tbl_users")
          .select("user_id, first_name, last_name, email_address")
          .in("user_id", proctorIds);

        if (proctorUserError) throw proctorUserError;
        setUsers(proctorUsers || []);

        // Step 4: Fetch dean info
        const { data: deanRole } = await supabase
          .from("tbl_user_role")
          .select("user_id")
          .in("college_id", schedulerColleges)
          .eq("role_id", 1)
          .single();

        if (deanRole) {
          const { data: deanUser } = await supabase
            .from("tbl_users")
            .select("first_name, last_name")
            .eq("user_id", deanRole.user_id)
            .single();

          if (deanUser) setDeanName(`${deanUser.first_name} ${deanUser.last_name}`);
        }
      } catch (err) {
        console.error("Error loading users:", err);
        toast.error("Failed to load users");
      }
    };

    fetchUsers();
  }, [user]);

  const handleSendEmail = async () => {
    if (selectedUsers.length === 0) {
      toast.warn("Please select at least one user");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.warn("Please enter a subject and message body");
      return;
    }

    setLoading(true);

    try {
      const notifications = selectedUsers.map(u => ({
        user_id: u.user_id,
        title: "Email Notification",
        message: `${subject}\n\n${body}`,
        type: "email",
        status: "unread",
        is_seen: false,
        priority: 1,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("tbl_notification").insert(notifications);
      if (error) throw error;

      toast.success(`Email sent to ${selectedUsers.length} user(s)!`);
      onClose();
    } catch (err) {
      console.error("Error sending email:", err);
      toast.error("Failed to send email");
    } finally {
      setLoading(false);
    }
  };

  const options = users.map(u => ({
    value: u.user_id,
    label: `${u.first_name} ${u.last_name}${u.email_address ? ` - ${u.email_address}` : ""}`,
    user: u
  }));

  return (
    <div className="message-sender-container">
      <div className="message-sender-header">
        <h3>Send Email to Proctors</h3>
      </div>

      <div className="message-sender-body">
        <div className="message-section">
          <label>Select Proctors:</label>
          <Select
            options={[{ value: "select_all", label: "- Select All -" }, ...options]}
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
                  u.email_address ? ` - ${u.email_address}` : ""
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
            placeholder="Enter email subject..."
            className="subject-input"
          />

          <label>Message Body:</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Enter your email content..."
            rows={8}
          />
          <div className="char-count">{body.length} characters</div>
        </div>
      </div>

      <div className="message-sender-footer">
        <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
        <button
          type="button"
          onClick={handleSendEmail}
          className="btn-send"
          disabled={loading || selectedUsers.length === 0 || !subject.trim() || !body.trim()}
        >
          {loading ? "Sending..." : `Send Email to ${selectedUsers.length} user(s)`}
        </button>
      </div>
    </div>
  );
};

export default EmailSender;
