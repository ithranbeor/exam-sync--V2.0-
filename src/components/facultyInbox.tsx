import React, { useEffect, useState } from "react";
import { useRef } from "react";
import {FaTrash,FaTrashRestore,FaEnvelope,FaEnvelopeOpen,FaPlus,FaRegStar,FaEnvelopeSquare,FaPaperclip} from "react-icons/fa";
import { HiPaperAirplane } from "react-icons/hi2";
import { FaFilePdf, FaFileWord, FaFileExcel, FaFileImage, FaFileVideo, FaFileAlt } from "react-icons/fa";
import { supabase } from "../lib/supabaseClient.ts";
import "../styles/inbox.css";

type Attachment = {
  name: string;
  url: string;
  type: string;
  size: number;
};

type Reply = {
  reply_id: number;
  message_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  attachments?: Attachment[];
  sender?: { first_name: string; last_name: string; email_address: string };
};

type InboxMessage = { 
  message_id: number;
  subject: string | null;
  message_body: string | null;
  is_read: boolean;
  is_deleted: boolean;
  is_important?: boolean;
  created_at: string;
  sender?: { user_id: number; email_address: string; first_name: string; last_name: string } | null;
  receiver?: { user_id: number; email_address: string; first_name: string; last_name: string } | null;
  attachments?: Attachment[] | null;
  replies?: Reply[];
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
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [_tick, setTick] = useState(0);
  const [viewImportant, setViewImportant] = useState(false);

  function getFileIcon(file: Attachment) {
    const type = file.type.toLowerCase();
    if (type.includes("image")) return <FaFileImage style={{ color: "#4CAF50" }} />;
    if (type.includes("video")) return <FaFileVideo style={{ color: "#f44336" }} />;
    if (type.includes("pdf")) return <FaFilePdf style={{ color: "#E53935" }} />;
    if (type.includes("word")) return <FaFileWord style={{ color: "#1976D2" }} />;
    if (type.includes("excel")) return <FaFileExcel style={{ color: "#388E3C" }} />;
    return <FaFileAlt style={{ color: "#757575" }} />;
  }

  function parseSupabaseDate(dateStr: string): Date {
    // Supabase usually returns "YYYY-MM-DDTHH:mm:ss+00:00" (ISO with timezone)
    // But if it's missing the timezone, force UTC by appending "Z"
    if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
      return new Date(dateStr + "Z");
    }
    return new Date(dateStr);
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1); // force re-render every 30s
    }, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedMsg, selectedMsg?.replies]);

  // Absolute + relative date
    function toLocalDate(dateStr: string): Date {
      return new Date(dateStr); // JS handles UTC → local conversion
    }

  // Relative time helper
  // Relative time
  function formatRelativeTime(dateString: string) {
    const date = parseSupabaseDate(dateString);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;

    if (diff < 60) return `${Math.max(1, Math.floor(diff))}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatMessageDate(dateStr: string) {
    const date = parseSupabaseDate(dateStr);
    const now = new Date();

    const absolute =
      date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      `, ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`;

    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const relative =
      diffDays === 0
        ? "Today"
        : diffDays === 1
        ? "1 day ago"
        : `${diffDays}d ago`;

    return `${absolute} (${relative})`;
  }

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

  // ✅ Permanently delete (from DB) 
  const permanentDeleteMessage = async (id: number) => {
    await supabase.from("tbl_inbox").delete().eq("message_id", id);
    setDeletedMessages(prev => prev.filter(m => m.message_id !== id));
    if (selectedMsg?.message_id === id) setSelectedMsg(null);
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
        sender:tbl_users!sender_id(user_id, email_address, first_name, last_name),
        receiver:tbl_users!receiver_id(user_id, email_address, first_name, last_name),
        replies:tbl_replies(
          reply_id,
          message_id,
          sender_id,
          body,
          created_at,
          attachments,
          sender:tbl_users!sender_id(user_id, first_name, last_name, email_address)
        )
      `)
      .or(`receiver_id.eq.${user.user_id},sender_id.eq.${user.user_id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    // 🔥 Fix: unwrap sender/receiver arrays
    const normalized = (data || []).map(m => ({
      ...m,
      sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
      receiver: Array.isArray(m.receiver) ? m.receiver[0] : m.receiver,
      replies: (m.replies || []).map(r => ({
        ...r,
        sender: Array.isArray(r.sender) ? r.sender[0] : r.sender,
      })),
    }));

    setMessages(
      normalized.filter(m => {
        const isReceiver = m.receiver && m.receiver.user_id === user.user_id;
        const isSenderWithReplies = m.sender && m.sender.user_id === user.user_id && (m.replies?.length ?? 0) > 0;
        return !m.is_deleted && (isReceiver || isSenderWithReplies);
      })
    );

    setSentMessages(
      normalized.filter(m => m.sender && !m.is_deleted && m.sender.user_id === user.user_id)
    );
    setDeletedMessages(normalized.filter(m => m.is_deleted));
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

    const filteredFiles = files.filter(file => file.size <= 50 * 1024 * 1024);
    if (filteredFiles.length !== files.length) {
      alert("Some files exceeded 50MB and were skipped.");
    }

    // Limit total attachments to 10
    const totalFiles = attachments.length + filteredFiles.length;
    if (totalFiles > 10) {
      alert("Maximum 10 attachments allowed.");
      filteredFiles.splice(10 - attachments.length); // keep only remaining slots
    }

    setAttachments(prev => [...prev, ...filteredFiles]);
  };

  const handleReplySend = async () => {
    if (!selectedMsg) return;
    if (!composeData.body.trim() && attachments.length === 0) return;

    const uploaded: Attachment[] = [];

    for (const file of attachments) {
      const filePath = `${user.user_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("inbox_attachments")
        .upload(filePath, file);
      if (uploadError) continue;

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

    const { data, error } = await supabase
      .from("tbl_replies")
      .insert({
        message_id: selectedMsg.message_id,
        sender_id: user.user_id,
        body: composeData.body,
        attachments: uploaded.length ? uploaded : null,
      })
      .select(`
        reply_id, message_id, sender_id, body, created_at, attachments,
        sender:tbl_users!sender_id(user_id, first_name, last_name, email_address)
      `)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    // ✅ Normalize sender in case it's returned as an array
    const newReply: Reply = {
      reply_id: data.reply_id,
      message_id: data.message_id,
      sender_id: data.sender_id,
      body: data.body,
      created_at: data.created_at,
      attachments: data.attachments,
      sender: Array.isArray(data.sender) ? data.sender[0] : data.sender,
    };

    // ✅ Update modal view (selected message)
    setSelectedMsg(prev =>
      prev ? { ...prev, replies: [...(prev.replies || []), newReply] } : prev
    );

    // ✅ Update main messages state
    setMessages(prev =>
      prev.map(m =>
        m.message_id === newReply.message_id
          ? { ...m, replies: [...(m.replies || []), newReply] }
          : m
      )
    );

    // ✅ Reset compose inputs
    setComposeData({ ...composeData, body: "" });
    setAttachments([]);
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

      if (selectedMsg) {
        // It's a reply
        const newReply: Reply = {
          reply_id: Date.now(),
          message_id: selectedMsg.message_id,
          sender_id: user.user_id,
          body: composeData.body,
          created_at: new Date().toISOString(),
          attachments: uploaded,
          sender: {
            first_name: user.first_name,
            last_name: user.last_name,
            email_address: user.email_address,
          },
        };

        // Update selected message and main message list
        setSelectedMsg(prev => prev ? { ...prev, replies: [...(prev.replies || []), newReply] } : prev);

        setMessages(prev =>
          prev.map(m => m.message_id === selectedMsg.message_id
            ? { ...m, replies: [...(m.replies || []), newReply] }
            : m
          )
        );

        setSentMessages(prev =>
          prev.map(m => m.message_id === selectedMsg.message_id
            ? { ...m, replies: [...(m.replies || []), newReply] }
            : m
          )
        );
      } else {
        // New standalone message
        setSentMessages(prev => [newMsg, ...prev]);
      }

      alert("Message sent!");
      setShowCompose(false);
      setComposeData({ to: "", subject: "", body: "" });
      setAttachments([]);
    }
  };

  return (
    <div className="inbox-layout">
      {/* Sidebar */}
      <div className="inbox-sidebar">
        <h3>Menu</h3>
        <ul>
          <li onClick={() => {
              setViewImportant(false);  // ✅ reset Important view
              setViewDeleted(false);
              setViewSent(false);
          }}>
            <FaEnvelope /> Inbox
          </li>
          <li onClick={() => {
              setViewImportant(true);
              setViewDeleted(false);
              setViewSent(false);
          }}>
            <FaRegStar /> Important
          </li>
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
            <FaPlus 
              title="Compose" 
              className="inbox-action-icon" 
              onClick={() => {
                setShowCompose(true);
                setComposeData({ to: "", subject: "", body: "" }); // blank for new message
              }} 
            />
            <FaEnvelope title="Mark all as Unread" className="inbox-action-icon" onClick={markAllAsUnread} />
            <FaEnvelopeOpen title="Mark all as Read" className="inbox-action-icon" onClick={markAllAsRead} />
            <FaTrash
              title="Delete Mode"
              className={`inbox-action-icon ${deleteMode ? "active" : ""}`}
              onClick={() => setDeleteMode(d => !d)}
            />
          </div>
        </div>

        <p className="inbox-message">
          {viewDeleted ? "Messages in trash" : viewSent ? "Messages you have sent" : "Your messages"}
        </p>

        {deleteMode && !viewDeleted && messages.length > 0 && (
          <button type="button" className="delete-all-btn" onClick={deleteAll}>Delete All</button>
        )}

        {/* Messages List */}
        {(viewDeleted ? deletedMessages : viewSent ? sentMessages : viewImportant ? messages.filter(m => m.is_important) : messages).map(msg => {
          // Get the most recent message (last reply or original)
          const lastMessage = msg.replies?.length
            ? msg.replies[msg.replies.length - 1].body
            : msg.message_body || "";

          // Limit preview text to 10 characters
          const previewText = lastMessage.length > 10 ? lastMessage.slice(0, 10) + "..." : lastMessage;

          // Build participants list: include sender + receiver
          const participantsSet = new Set<string>();
          participantsSet.add(msg.sender?.user_id === user.user_id ? "Me" : msg.sender?.first_name || "Unknown");
          if (msg.receiver && msg.receiver.user_id !== msg.sender?.user_id) {
            participantsSet.add(msg.receiver.user_id === user.user_id ? "Me" : msg.receiver.first_name || "Unknown");
          }

          // Join participants and truncate to 20 characters
          let participants = Array.from(participantsSet).join(", ");
          if (participants.length > 20) participants = participants.slice(0, 17) + "...";

          return (
            <div
              key={msg.message_id}
              className={`inbox-card ${msg.is_read ? "read" : "unread"}`}
              onClick={async () => {
                if (!deleteMode) {
                  setSelectedMsg(msg);
                  if (!msg.is_read) {
                    await supabase.from("tbl_inbox").update({ is_read: true }).eq("message_id", msg.message_id);
                    setMessages(prev =>
                      prev.map(m => (m.message_id === msg.message_id ? { ...m, is_read: true } : m))
                    );
                  }
                }
              }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              {/* Left: participants indicator */}
              
              <div className="inbox-left" style={{ flex: "0 0 200px" }}>
                <span 
                  onClick={async e => {
                    e.stopPropagation();
                    await supabase.from("tbl_inbox").update({ is_important: !msg.is_important }).eq("message_id", msg.message_id);
                    setMessages(prev =>
                      prev.map(m => m.message_id === msg.message_id ? { ...m, is_important: !m.is_important } : m)
                    );
                  }}
                  style={{ cursor: "pointer", color: msg.is_important ? "gold" : "#ccc" }}
                >
                  <FaRegStar />
                </span>
                <span className="inbox-sender">{participants}</span>
              </div>

              {/* Center: subject + preview */}
              <div className="inbox-center" style={{ flex: 1, marginLeft: "16px" }}>
                <strong>{msg.subject || "(No Subject)"}</strong>{" "}
                <span className="inbox-preview">– {previewText}</span>
              </div>

              {/* Right: date */}
              <div className="inbox-date" style={{ flex: "0 0 auto", marginLeft: "16px" }}>
                {formatMessageDate(msg.created_at)} 
              </div>

              {/* Delete/restore buttons */}
              {deleteMode && !viewDeleted && !viewSent && (
                <button type="button" className="row-delete-btn" onClick={() => deleteMessage(msg.message_id)}>
                  <FaTrash />
                </button>
              )}
              {viewDeleted && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="row-restore-btn"
                    onClick={() => restoreMessage(msg.message_id)}
                  >
                    <FaTrashRestore />
                  </button>
                  <button
                    type="button"
                    className="row-delete-btn"
                    style={{ color: "red" }}
                    onClick={() => permanentDeleteMessage(msg.message_id)}
                  >
                    <FaTrash /> Delete Forever
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {selectedMsg && (
          <div className="modal-overlay" onClick={() => setSelectedMsg(null)}>
            <div
              className="modal-pane"
              onClick={e => e.stopPropagation()}
              style={{ display: "flex", flexDirection: "column", height: "90vh", width: "100vh" }}
            >
              {/* Header */}
              <div className="modal-header">
                <div className="sender-info">
                  <div className="subject-title">
                    <strong></strong> {selectedMsg.subject}
                  </div>
                  <strong>
                    {selectedMsg.sender
                      ? `${selectedMsg.sender.first_name} ${selectedMsg.sender.last_name}`
                      : "Unknown"}
                  </strong>
                  <span className="message-date">
                    {formatMessageDate(selectedMsg.created_at)}
                  </span>
                </div>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => deleteMessage(selectedMsg.message_id)}
                >
                  <FaTrash />
                </button>
              </div>

              {/* Messages container */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "0 24px",
                  marginBottom: "12px",
                }}
              >
                {/* Original message */}
                <div
                  className={`chat-message ${
                    selectedMsg.sender?.user_id === user.user_id ? "sent" : "received"
                  }`}
                >
                  <div className="chat-header">
                    {selectedMsg.sender?.user_id === user.user_id
                      ? "You"
                      : `${selectedMsg.sender?.first_name} ${selectedMsg.sender?.last_name}`} •
                      <span style={{ color: "#888", fontSize: "0.9em"}}>
                        {formatMessageDate(selectedMsg.created_at)}{" "}
                      </span>
                  </div>
                  <div className="chat-body">
                    <p>{selectedMsg.message_body}</p>
                    {(selectedMsg.attachments ?? []).length > 0 && (
                      <div className="chat-attachments-grid" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                        {(selectedMsg.attachments ?? []).map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "6px 10px",
                              border: "1px solid #ccc",
                              borderRadius: "6px",
                              background: "#f4f4f4",
                              textDecoration: "none",
                              color: "black",
                              fontSize: "0.85rem",
                              maxWidth: "180px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={att.name}
                          >
                            {getFileIcon(att)}
                            <span style={{ marginLeft: "6px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {att.name} ({(att.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Replies */}
                {selectedMsg.replies?.map(reply => (
                  <div
                    key={reply.reply_id}
                    className={`chat-message ${
                      reply.sender_id === user.user_id ? "sent" : "received"
                    }`}
                  >
                    <div className="chat-header">
                      {reply.sender_id === user.user_id
                        ? "You"
                        : `${reply.sender?.first_name} ${reply.sender?.last_name}`} •
                      <span style={{ color: "#888", fontSize: "0.9em" }}>
                        {formatMessageDate(reply.created_at)}{" "}
                      </span>
                    </div>
                    <div className="chat-body">
                      <p>{reply.body}</p>
                      {(reply.attachments ?? []).length > 0 && (
                        <div className="chat-attachments-grid" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                          {(reply.attachments ?? []).map((att, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "6px 10px",
                                border: "1px solid #ccc",
                                borderRadius: "6px",
                                background: "#f4f4f4",
                                textDecoration: "none",
                                color: "black",
                                fontSize: "0.85rem",
                                maxWidth: "180px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={att.name}
                            >
                              {getFileIcon(att)}
                              <span style={{ marginLeft: "6px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {att.name} ({(att.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Invisible marker for auto-scroll */}
                <div ref={messagesEndRef} />
              </div>

              {/* Fixed Textarea at bottom */}

              <div className="input-text-container" style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <textarea
                    placeholder="Type your reply..."
                    value={composeData.body}
                    ref={composeRef}
                    onChange={e =>
                      setComposeData({
                        ...composeData,
                        body: e.target.value,
                        to: selectedMsg?.sender?.user_id.toString() || "",
                      })
                    }
                    onInput={e => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                    style={{
                      flexGrow: 1,
                      minHeight: "0%",
                      maxHeight: "150px",
                      width: "590px",
                      resize: "none",
                      borderRadius: "20px",
                      padding: "10px 40px 0px 10px",
                      border: "2px solid #ccc",
                      fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
                      background: "white",
                      color: "black"

                    }}
                  />

                  <label
                    htmlFor="reply-attachment"
                    style={{
                      position: "absolute",
                      left: "40px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      cursor: "pointer",
                      fontSize: "1.2rem",
                      color: "#092c4c",
                    }}
                  >
                    <FaPaperclip />
                  </label>
                  <input
                    id="reply-attachment"
                    type="file"
                    multiple
                    style={{ display: "none" }}
                    onChange={e => {
                      if (!e.target.files) return;
                      const newFiles = Array.from(e.target.files);

                      // Limit: max 10 files
                      const combinedFiles = [...attachments, ...newFiles].slice(0, 10);

                      // Limit: max total 50MB
                      const totalSize = combinedFiles.reduce((sum, f) => sum + f.size, 0);
                      if (totalSize > 50 * 1024 * 1024) {
                        alert("Total attachments size cannot exceed 50MB. Some files were skipped.");
                        return;
                      }

                      setAttachments(combinedFiles);
                    }}
                    accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  />

                  <button
                    type="button"
                    onClick={handleReplySend}
                    style={{
                      position: "absolute",
                      right: "4px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: "1.4rem",
                      color: "#092c4c"
                    }}
                  >
                    <HiPaperAirplane />
                  </button>
                </div>

                {/* Attachments preview */}
                {(attachments ?? []).length > 0 && (
                  <div
                    className="attachments-preview"
                    style={{
                      display: "flex",
                      overflowX: "auto",
                      gap: "8px",
                      padding: "4px 0",
                    }}
                  >
                    {(attachments ?? []).map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flex: "0 0 auto",
                          padding: "6px 10px",
                          border: "1px solid #ccc",
                          borderRadius: "6px",
                          background: "#f4f4f4",
                          fontSize: "0.85rem",
                          maxWidth: "180px",
                          overflow: "hidden",
                          color: 'black'
                        }}
                      >
                        <FaPaperclip style={{ marginRight: "6px" }} />
                        <span
                          style={{
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={file.name}
                        >
                          {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            marginLeft: "4px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "red",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compose Modal */}
        {showCompose && (
          <div className="compose-modal-overlay" onClick={() => setShowCompose(false)}>
            <div className="compose-modal-pane" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="compose-modal-header">
                <h3>Compose Message</h3>
                <button type= 'button' onClick={() => setShowCompose(false)}>✕</button>
              </div>

              {/* Form Body */}
              <div className="compose-modal-body">
                <input
                  type="text"
                  placeholder="To"
                  value={composeData.to}
                  onChange={e => setComposeData({ ...composeData, to: e.target.value })}
                  className="compose-modal-input"
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeData.subject}
                  onChange={e => setComposeData({ ...composeData, subject: e.target.value })}
                  className="compose-modal-input"
                />

                {/* Textarea with buttons inside */}
                <div className="compose-modal-textarea-wrapper">
                  <textarea
                    placeholder="Type your message..."
                    value={composeData.body}
                    onChange={e => setComposeData({ ...composeData, body: e.target.value })}
                    onInput={e => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                    className="compose-modal-textarea"
                  />

                  {/* Attachment button inside textarea */}
                  <label htmlFor="compose-modal-attachment" className="compose-modal-attachment-label">
                    <FaPaperclip />
                  </label>
                  <input
                    id="compose-modal-attachment"
                    type="file"
                    multiple
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />

                  {/* Send button inside textarea */}
                  <button
                    type="button"
                    onClick={handleSend}
                    className="compose-modal-send-button"
                  >
                    <HiPaperAirplane />
                  </button>

                  {/* Attachments preview inside textarea area */}
                  {attachments.length > 0 && (
                    <div className="compose-modal-attachments-preview-inside">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="compose-modal-attachment-item-small">
                          <FaPaperclip style={{ marginRight: "4px" }} />
                          <span title={file.name}>
                            {file.name.length > 15 ? file.name.slice(0, 12) + "..." : file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="compose-modal-attachment-remove"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
