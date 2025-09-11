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
  subject: string | null;
  message_body: string | null;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
  sender?: { first_name: string; last_name: string } | null;
  receiver?: { first_name: string; last_name: string } | null;
  attachments?: Attachment[] | null;
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
  const [composeData, setComposeData] = useState({ to: "", subject: "", body: "" });
  const [attachments, setAttachments] = useState<File[]>([]);


  // ✅ Actions
  const markAllAsRead = async () => {
    await supabase.from("tbl_inbox").update({ is_read: true }).eq("receiver_id", user.user_id);
    setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
  };

  const markAllAsUnread = async () => {
    await supabase.from("tbl_inbox").update({ is_read: false }).eq("receiver_id", user.user_id);
    setMessages(prev => prev.map(m => ({ ...m, is_read: false })));
  };

  const deleteMessage = async (id: number) => {
    await supabase.from("tbl_inbox").update({ is_deleted: true }).eq("message_id", id);
    setMessages(prev => prev.filter(m => m.message_id !== id));
    setDeletedMessages(prev => prev.filter(m => m.message_id !== id));
    setSentMessages(prev => prev.filter(m => m.message_id !== id));
    setSelectedMsg(null);
  };

  const deleteAll = async () => {
    await supabase.from("tbl_inbox").update({ is_deleted: true }).eq("receiver_id", user.user_id);
    setDeletedMessages(prev => [...messages, ...prev]);
    setMessages([]);
  };

  // Inside the component
  const loadMessages = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("tbl_inbox")
      .select(`
        message_id,
        subject,
        message_body,
        is_read,
        is_deleted,
        created_at,
        attachments,
        sender_id,
        receiver_id,
        sender_uuid,
        receiver_uuid,
        sender:tbl_users!sender_id(first_name, last_name),
        receiver:tbl_users!receiver_id(first_name, last_name)
      `)
      .or(`receiver_id.eq.${user.user_id},sender_id.eq.${user.user_id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      const normalized = data.map((m: any) => ({
        ...m,
        sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
        receiver: Array.isArray(m.receiver) ? m.receiver[0] : m.receiver,
      }));

      setMessages(normalized.filter((m: any) => m.receiver && !m.is_deleted && m.receiver_id === user.user_id));
      setSentMessages(normalized.filter((m: any) => m.sender && !m.is_deleted && m.sender_id === user.user_id));
      setDeletedMessages(normalized.filter((m: any) => m.is_deleted));

      console.log("Fetched messages:", normalized);
    }
  };

  // Then inside useEffect just call it:
  useEffect(() => {
    loadMessages();
  }, [user]);

  const restoreMessage = async (id: number) => {
    await supabase.from("tbl_inbox").update({ is_deleted: false }).eq("message_id", id);
    setDeletedMessages(prev => prev.filter(m => m.message_id !== id));
    loadMessages(); // refresh inbox after restore
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => file.size <= 50 * 1024 * 1024);
    if (validFiles.length !== files.length) alert("Some files were too large (50MB max) and skipped.");

    setAttachments(prev => [...prev, ...validFiles]);
  };

  const handleSend = async () => {
    if (!composeData.to) {
      alert("Please provide a recipient.");
      return;
    }

    // Get receiver
    const { data: receiverData, error: receiverError } = await supabase
      .from("tbl_users")
      .select("user_id, email_address, first_name, last_name")
      .or(`email_address.eq.${composeData.to},user_id.eq.${composeData.to}`)
      .single();

    if (receiverError || !receiverData) {
      alert("Receiver not found.");
      return;
    }

    const receiverId = receiverData.user_id;

    // Get roles
    const { data: receiverRoles } = await supabase
      .from("tbl_user_role")
      .select("user_role_id")
      .eq("user_id", receiverId)
      .limit(1);

    const { data: senderRoles } = await supabase
      .from("tbl_user_role")
      .select("user_role_id")
      .eq("user_id", user.user_id)
      .limit(1);

    if (!receiverRoles?.length || !senderRoles?.length) {
      alert("Sender or receiver does not have a role assigned.");
      return;
    }

    const receiverRoleId = receiverRoles[0].user_role_id;
    const senderRoleId = senderRoles[0].user_role_id;

    // Upload attachments
    const uploaded: Attachment[] = [];
    for (const file of attachments) {
      if (file.size > 50 * 1024 * 1024) {
        alert(`${file.name} exceeds 50MB limit and was skipped.`);
        continue;
      }

      const filePath = `${user.user_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("inbox_attachments").upload(filePath, file);
      if (uploadError) {
        alert(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: publicUrl } = supabase.storage.from("inbox_attachments").getPublicUrl(filePath);
      uploaded.push({
        name: file.name,
        url: publicUrl.publicUrl,
        type: file.type,
        size: file.size,
      });
    }

    // Insert message
    const { data: insertedMessages, error } = await supabase
      .from("tbl_inbox")
      .insert({
        sender_id: user.user_id,
        sender_role: senderRoleId,
        receiver_id: receiverId,
        receiver_role: receiverRoleId,
        subject: composeData.subject || null,
        message_body: composeData.body || null,
        is_read: false,
        is_deleted: false,
        attachments: uploaded.length > 0 ? uploaded : null,
      })
      .select("*");

    if (!error && insertedMessages?.length) {
      const newMsg = insertedMessages[0];
      setSentMessages(prev => [newMsg, ...prev]);
      alert("Message sent!");
      setShowCompose(false);
      setComposeData({ to: "", subject: "", body: "" });
      setAttachments([]);
    } else if (error) {
      alert("Failed to send: " + error.message);
    }
  };

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

      {/* Main */}
      <div className="inbox-container">
        <div className="inbox-banner">
          <span>
            {viewDeleted ? "Recently Deleted" : viewSent ? "Sent" : "Inbox"} {deleteMode && "(Delete Mode)"}
          </span>
          <div className="inbox-actions">
            <FaPlus title="Compose" className="inbox-action-icon" onClick={() => setShowCompose(true)} />
            <FaEnvelope title="Mark all as Unread" className="inbox-action-icon" onClick={markAllAsUnread} />
            <FaEnvelopeOpen title="Mark all as Read" className="inbox-action-icon" onClick={markAllAsRead} />
            <FaTrash
              title="Delete Mode"
              className={`inbox-action-icon ${deleteMode ? "active" : ""}`}
              onClick={() => setDeleteMode(d => !d)}
            />
            <FaTrashRestore
              title="View Recently Deleted"
              className="inbox-action-icon"
              onClick={() => setViewDeleted(v => !v)}
            />
          </div>
        </div>

        <p className="inbox-message">
          {viewDeleted ? "Messages in trash" : viewSent ? "Messages you have sent" : "You have received new messages!"}
        </p>

        {deleteMode && !viewDeleted && messages.length > 0 && (
          <button type="button" className="delete-all-btn" onClick={deleteAll}>Delete All</button>
        )}

        {/* Messages List */}
        {(viewDeleted ? deletedMessages : viewSent ? sentMessages : messages).map(msg => (
          <div
            key={msg.message_id}
            className={`inbox-card ${msg.is_read ? "read" : "unread"}`}
            onClick={() => !deleteMode && setSelectedMsg(msg)}
          >
            <div className="inbox-left">
              <span className="inbox-icon">✉️</span>
              <span className="inbox-sender">
                {msg.sender
                  ? `${msg.sender.first_name} ${msg.sender.last_name}`
                  : "Unknown"}
              </span>
            </div>
            <div className="inbox-center">• {msg.subject}</div>
            <div className="inbox-date">{new Date(msg.created_at).toLocaleDateString()}</div>

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

        {/* Selected Message */}
        {selectedMsg && (
          <div className="inbox-modal-overlay" onClick={() => setSelectedMsg(null)}>
            <div className="inbox-modal-pane" onClick={e => e.stopPropagation()}>
              <div className="inbox-modal-header">
                <div>
                  <h3>
                    From: {selectedMsg.sender
                      ? `${selectedMsg.sender.first_name} ${selectedMsg.sender.last_name}`
                      : "Unknown"}
                  </h3>
                  <h4>Subject: {selectedMsg.subject}</h4>
                </div>
                <button type="button" className="inbox-modal-delete-btn" onClick={() => deleteMessage(selectedMsg.message_id)}>
                  <FaTrash />
                </button>
              </div>

              <div className="inbox-message-body"><p>{selectedMsg.message_body}</p></div>
              {selectedMsg.attachments?.map((att, idx) => (
                <div key={idx} className="inbox-attachment">
                  📎 <a href={att.url} target="_blank" rel="noreferrer">{att.name}</a>
                </div>
              ))}

              <div className="inbox-modal-actions">
                <button type="button" onClick={() => {
                  setShowCompose(true);
                  setComposeData({
                    to: selectedMsg.sender?.first_name || "", // <- removed [0]
                    subject: `Re: ${selectedMsg.subject}`,
                    body: `\n\n--- Original Message ---\n${selectedMsg.message_body}`,
                  });
                }}>Reply</button>
                <button type="button" onClick={() => setSelectedMsg(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Compose Modal */}
        {showCompose && (
          <div className="inbox-modal-overlay" onClick={() => setShowCompose(false)}>
            <div className="inbox-modal-pane" onClick={e => e.stopPropagation()}>
              <h3>Compose Message</h3>
              <div className="compose-form">
                <input type="text" placeholder="To" value={composeData.to} onChange={e => setComposeData({ ...composeData, to: e.target.value })} />
                <input type="text" placeholder="Subject" value={composeData.subject} onChange={e => setComposeData({ ...composeData, subject: e.target.value })} />
                <textarea placeholder="Message" value={composeData.body} onChange={e => setComposeData({ ...composeData, body: e.target.value })} />

                <input type="file" multiple onChange={handleFileChange} accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                <ul>{attachments.map((file, idx) => <li key={idx}>{file.name} ({(file.size/1024/1024).toFixed(2)} MB)</li>)}</ul>
              </div>
              <div className="inbox-modal-actions">
                <button type="button" onClick={handleSend}>Send</button>
                <button type="button" onClick={() => setShowCompose(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
