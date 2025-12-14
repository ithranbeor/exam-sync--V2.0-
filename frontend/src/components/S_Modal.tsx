// Modal.tsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import { useEscapeKey } from "../hooks/useEscapeKey";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  // Create modal root if it doesn't exist
  useEffect(() => {
    let root = document.getElementById("modal-root");
    if (!root) {
      root = document.createElement("div");
      root.setAttribute("id", "modal-root");
      document.body.appendChild(root);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  // Handle ESC key to close modal
  useEscapeKey(handleClose, isOpen);

  if (!isOpen && !isAnimating) return null;

  const modalContent = (
    <>
      {/* Translucent overlay */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: isAnimating ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0)",
          zIndex: 900,
          transition: "background 0.3s ease",
          pointerEvents: isAnimating ? "auto" : "none",
        }}
      />

      {/* Dropdown card with animation */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-scroll"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) translateY(${isAnimating ? "0" : "-20px"})`,
          zIndex: 1000,
          pointerEvents: "auto",
          maxWidth: "95vw",
          maxHeight: "95vh",
          width: "90%",
          height: "90%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "white",
          borderRadius: "20px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          opacity: isAnimating ? 1 : 0,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Sticky Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            backgroundColor: "white",
            padding: "20px 30px",
            borderBottom: "2px solid #e2e8f0",
            borderRadius: "20px 20px 0 0",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Header Title */}
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              color: "#0d3b66",
              letterSpacing: "-0.2px",
            }}
          >
            Plot Exam Schedule
          </h2>

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            style={{
              position: "relative",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "20px",
              color: "#092C4C",
              padding: "5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(9, 44, 76, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FaTimes />
          </button>
        </div>

        {/* Scrollable Modal content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "30px",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );

  const root = document.getElementById("modal-root") as HTMLElement | null;
  return root ? createPortal(modalContent, root) : null;
};

export default Modal;