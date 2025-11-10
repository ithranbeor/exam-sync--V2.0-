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
}

const SmsSender: React.FC<SmsSenderProps> = ({ onClose, collegeName, user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        if (!user?.user_id) return;

        // Get scheduler's college(s)
        const { data: schedulerRoles, error: schedulerError } = await supabase
          .from("tbl_user_role")
          .select("college_id")
          .eq("user_id", user.user_id)
          .eq("role_id", 3); // Scheduler

        if (schedulerError || !schedulerRoles?.length) {
          toast.error("Failed to find scheduler college");
          return;
        }

        const schedulerColleges = schedulerRoles.map(r => r.college_id).filter(Boolean);

        // Get proctors under same college(s)
        const { data: proctorRoles, error: proctorRoleError } = await supabase
          .from("tbl_user_role")
          .select("user_id")
          .in("college_id", schedulerColleges)
          .eq("role_id", 5); // Proctor

        if (proctorRoleError || !proctorRoles?.length) {
          setUsers([]);
          toast.warn("No proctors found under your college");
          return;
        }

        const proctorIds = proctorRoles.map(r => r.user_id);

        // Fetch proctor details
        const { data: proctorUsers, error: proctorUserError } = await supabase
          .from("tbl_users")
          .select("user_id, first_name, last_name, contact_number")
          .in("user_id", proctorIds);

        if (proctorUserError) throw proctorUserError;
        setUsers(proctorUsers || []);
      } catch (err) {
        console.error("Error loading users:", err);
        toast.error("Failed to load users");
      }
    };

    fetchUsers();
  }, [user]);

  const handleSendSms = async () => {
    if (selectedUsers.length === 0) {
      toast.warn("Please select at least one user");
      return;
    }

    if (!message.trim()) {
      toast.warn("Please enter a message");
      return;
    }

    setLoading(true);

    try {
      const notifications = selectedUsers.map(u => ({
        user_id: u.user_id,
        title: "SMS Notification",
        message,
        type: "sms",
        status: "unread",
        is_seen: false,
        priority: 1,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("tbl_notification").insert(notifications);
      if (error) throw error;

      toast.success(`SMS sent to ${selectedUsers.length} user(s)!`);
      onClose();
    } catch (err) {
      console.error("Error sending SMS:", err);
      toast.error("Failed to send SMS");
    } finally {
      setLoading(false);
    }
  };

  // Convert to react-select options
  const options = users.map(u => ({
    value: u.user_id,
    label: `${u.first_name} ${u.last_name}${
      u.contact_number ? ` - ${u.contact_number}` : ""
    }`,
    user: u,
  }));

  return (
    <div className="message-sender-container">
      <div className="message-sender-header">
        <h3>Send SMS to Proctors</h3>
      </div>

      <div className="message-sender-body">
        <div className="message-section">
          <label>Select Proctors:</label>
          <Select
            options={[{ value: "select_all", label: "- Select All -" }, ...options]}
            isMulti
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            onChange={(selected: any) => {
              if (!selected) {
                setSelectedUsers([]);
                return;
              }

              const lastSelected = selected[selected.length - 1];
              if (lastSelected?.value === "select_all") {
                // Toggle all
                if (selectedUsers.length < users.length) {
                  setSelectedUsers(users);
                } else {
                  setSelectedUsers([]);
                }
              } else {
                const filtered = selected
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
                  u.contact_number ? ` - ${u.contact_number}` : ""
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
          <label>Message:</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Enter your SMS message here..."
            rows={6}
            maxLength={160}
          />
          <div className="char-count">{message.length}/160 characters</div>
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
          disabled={loading || selectedUsers.length === 0 || !message.trim()}
        >
          {loading ? "Sending..." : `Send SMS to ${selectedUsers.length} user(s)`}
        </button>
      </div>
    </div>
  );
};

export default SmsSender;
