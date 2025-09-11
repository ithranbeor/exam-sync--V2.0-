import React, { useEffect, useState } from "react";
import {
  FaTrash,
  FaTrashRestore,
  FaEnvelope,
  FaEnvelopeOpen,
  FaPlus,
  FaRegStar,
  FaEnvelopeSquare,
} from "react-icons/fa";
import { supabase } from "../lib/supabaseClient.ts";
import "../styles/inbox.css";

type Attachment = {
  name: string;
  url: string;
  type: string;
  size: number;
};

type InboxMessage = {
  message_id: number;
  subject: string;
  message_body: string;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
  sender?: { first_name: string; last_name: string }[];
  receiver?: { first_name: string; last_name: string }[];
  attachments?: Attachment[];
};

const Inbox: React.FC<{ user: any }> = ({ user }) => {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<InboxMessage[]>([]);
  const [deletedMessages, setDeletedMessages] = useState<InboxMessage[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null);
  const [viewDeleted, setViewDeleted] = useState(false);
  const [viewSent, setViewSent] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [composeData, setComposeData] = useState({
    to: "",
    subject: "",
    body: "",
  });
  const [attachments, setAttachments] = useState<File[]>([]);

  // ✅ Load messages
  useEffect(() => {
    if (!user) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("tbl_inbox")
        .select(
          `message_id, subject, message_body, is_read, is_deleted, created_at,
           sender:sender_id(first_name,last_name),
           receiver:receiver_id(first_name,last_name),
           attachments`
        )
        .or(`receiver_id.eq.${user.user_id},sender_id.eq.${user.user_id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setMessages(
          data.filter((m: any) => m.receiver?.length && !m.is_deleted)
        );
        setSentMessages(
          data.filter(
            (m: any) => m.sender?.length && !m.is_deleted && m.sender_id === user.user_id
          )
        );
        setDeletedMessages(data.filter((m: any) => m.is_deleted));
      }
    };

    loadMessages();
  }, [user]);

  // ✅ Actions
  const markAllAsRead = async () => {
    await supabase
      .from("tbl_inbox")
      .update({ is_read: true })
      .eq("receiver_id", user.user_id);
    setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
  };

  const markAllAsUnread = async () => {
    await supabase
      .from("tbl_inbox")
      .update({ is_read: false })
      .eq("receiver_id", user.user_id);
    setMessages((prev) => prev.map((m) => ({ ...m, is_read: false })));
  };

  const deleteMessage = async (id: number) => {
    await supabase.from("tbl_inbox").update({ is_deleted: true }).eq("message_id", id);
    setMessages((prev) => prev.filter((m) => m.message_id !== id));
    setSelectedMsg(null);
  };

  const deleteAll = async () => {
    await supabase
      .from("tbl_inbox")
      .update({ is_deleted: true })
      .eq("receiver_id", user.user_id);
    setDeletedMessages((prev) => [...messages, ...prev]);
    setMessages([]);
  };

  const restoreMessage = async (id: number) => {
    await supabase.from("tbl_inbox").update({ is_deleted: false }).eq("message_id", id);
    setDeletedMessages((prev) => prev.filter((m) => m.message_id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const validFiles = files.filter((file) => file.size <= 100 * 1024 * 1024); // 100 MB limit

    if (validFiles.length !== files.length) {
      alert("Some files were too large (max 100 MB each) and were skipped.");
    }

    setAttachments((prev) => [...prev, ...validFiles]);
  };

  const handleSend = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      alert("Please fill in all fields.");
      return;
    }

    // --- upload attachments to Supabase ---
    const uploaded: Attachment[] = [];
    for (const file of attachments) {
      const filePath = `${user.user_id}/${Date.now()}_${file.name}`;
      const { data: _data, error } = await supabase.storage
        .from("inbox_attachments")
        .upload(filePath, file);

      if (error) {
        console.error(error);
        alert(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: publicUrl } = supabase.storage
        .from("inbox_attachments")
        .getPublicUrl(filePath);

      uploaded.push({
        name: file.name,
        url: publicUrl.publicUrl,
        type: file.type,
        size: file.size,
      });
    }

    // --- insert message into DB ---
    const { error } = await supabase.from("tbl_inbox").insert({
      sender_id: user.user_id,
      subject: composeData.subject,
      message_body: composeData.body,
      attachments: uploaded, // ✅ save array of uploaded files
      // TODO: replace with actual receiver_id
      receiver_id: 2,
    });

    if (error) {
      console.error(error);
      alert("Failed to send");
    } else {
      alert("Message sent!");
      setShowCompose(false);
      setComposeData({ to: "", subject: "", body: "" });
      setAttachments([]);
    }
  };

  // ✅ UI
  return (
    <div className="inbox-layout">
      {/* Sidebar */}
      <div className="inbox-sidebar">
        <h3>Menu</h3>
        <ul>
          <li onClick={() => { setViewDeleted(false); setViewSent(false); }}>
            <FaEnvelope /> Inbox
          </li>
          <li><FaRegStar /> Important</li>
          <li onClick={() => { setViewDeleted(true); setViewSent(false); }}>
            <FaTrash /> Trash
          </li>
          <li onClick={() => { setViewSent(true); setViewDeleted(false); }}>
            <FaEnvelopeSquare /> Sent
          </li>
        </ul>
      </div>

      {/* Main Container */}
      <div className="inbox-container">
        {/* Banner */}
        <div className="inbox-banner">
          <span>
            {viewDeleted ? "Recently Deleted" : viewSent ? "Sent" : "Inbox"}{" "}
            {deleteMode && "(Delete Mode)"}
          </span>
          <div className="inbox-actions">
            <FaPlus title="Compose" className="inbox-action-icon" onClick={() => setShowCompose(true)} />
            <FaEnvelope title="Mark all as Unread" className="inbox-action-icon" onClick={markAllAsUnread} />
            <FaEnvelopeOpen title="Mark all as Read" className="inbox-action-icon" onClick={markAllAsRead} />
            <FaTrash
              title="Delete Mode"
              className={`inbox-action-icon ${deleteMode ? "active" : ""}`}
              onClick={() => setDeleteMode((d) => !d)}
            />
            <FaTrashRestore
              title="View Recently Deleted"
              className="inbox-action-icon"
              onClick={() => setViewDeleted((v) => !v)}
            />
          </div>
        </div>

        <p className="inbox-message">
          {viewDeleted
            ? "Messages in trash (can be restored)"
            : viewSent
            ? "Messages you have sent"
            : "You have received new messages!"}
        </p>

        {/* Delete All button */}
        {deleteMode && !viewDeleted && messages.length > 0 && (
          <button type="button" className="delete-all-btn" onClick={deleteAll}>
            Delete All
          </button>
        )}

        {/* Messages list */}
        {(viewDeleted ? deletedMessages : viewSent ? sentMessages : messages).map((msg) => (
          <div
            key={msg.message_id}
            className={`inbox-card ${msg.is_read ? "read" : "unread"}`}
            onClick={() => !deleteMode && setSelectedMsg(msg)}
          >
            <div className="inbox-left">
              <span className="inbox-icon">✉️</span>
              <span className="inbox-sender">
                {msg.sender?.[0]
                  ? `${msg.sender[0].first_name} ${msg.sender[0].last_name}`
                  : "Unknown"}
              </span>
            </div>
            <div className="inbox-center">• {msg.subject}</div>
            <div className="inbox-date">
              {new Date(msg.created_at).toLocaleDateString()}
            </div>

            {/* Buttons depend on menu */}
            {deleteMode && !viewDeleted && !viewSent && (
              <button type="button" className="row-delete-btn" onClick={() => deleteMessage(msg.message_id)}>
                <FaTrash />
              </button>
            )}
            {viewDeleted && (
              <button type="button" className="row-restore-btn" onClick={() => restoreMessage(msg.message_id)}>
                <FaTrashRestore />
              </button>
            )}
          </div>
        ))}

        {/* View Message Modal */}
        {selectedMsg && (
          <div className="inbox-modal-overlay" onClick={() => setSelectedMsg(null)}>
            <div className="inbox-modal-pane" onClick={(e) => e.stopPropagation()}>
              {/* Header with Delete on top-right */}
              <div className="inbox-modal-header">
                <div>
                  <h3>
                    From: {selectedMsg.sender?.[0]
                      ? `${selectedMsg.sender[0].first_name} ${selectedMsg.sender[0].last_name}`
                      : "Unknown"}
                  </h3>
                  <h4>Subject: {selectedMsg.subject}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMessage(selectedMsg.message_id)}
                  className="inbox-modal-delete-btn"
                  title="Delete Message"
                >
                  <FaTrash />
                </button>
              </div>

              <div className="inbox-message-body">
                <p>{selectedMsg.message_body}</p>
              </div>

              {/* Attachments */}
              {selectedMsg.attachments?.map((att, idx) => (
                <div key={idx} className="inbox-attachment">
                  📎 <a href={att.url} target="_blank" rel="noreferrer">{att.name}</a>
                </div>
              ))}

              {/* Footer actions */}
              <div className="inbox-modal-actions">
                <button
                  type="button"
                  className="inbox-reply-btn"
                  onClick={() => {
                    setShowCompose(true);
                    setComposeData({
                      to: selectedMsg.sender?.[0]
                        ? selectedMsg.sender[0].first_name
                        : "",
                      subject: `Re: ${selectedMsg.subject}`,
                      body: `\n\n--- Original Message ---\n${selectedMsg.message_body}`,
                    });
                  }}
                >
                  Reply
                </button>
                <button type="button" onClick={() => setSelectedMsg(null)} className="inbox-modal-button">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Compose Modal */}
        {showCompose && (
          <div className="inbox-modal-overlay" onClick={() => setShowCompose(false)}>
            <div className="inbox-modal-pane" onClick={(e) => e.stopPropagation()}>
              <h3>Compose Message</h3>
              <div className="compose-form">
                <input
                  type="text"
                  placeholder="To"
                  value={composeData.to}
                  onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                />
                <textarea
                  placeholder="Message"
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                />

                {/* File Upload */}
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                />
                <ul>
                  {attachments.map((file, idx) => (
                    <li key={idx}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </li>
                  ))}
                </ul>
              </div>
              <div className="inbox-modal-actions">
                <button type="button" onClick={handleSend} className="inbox-modal-button">
                  Send
                </button>
                <button type="button" onClick={() => setShowCompose(false)} className="inbox-modal-button">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;