// Modal.tsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";

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

  if (!isOpen && !isAnimating) return null;

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

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
          top: "70px", // Position below the icons card
          left: "52%",
          transform: `translateX(-50%) translateY(${isAnimating ? "0" : "-20px"})`,
          zIndex: 1000,
          pointerEvents: "auto",
          maxWidth: "90vw",
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          backgroundColor: "white",
          borderRadius: "20px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          padding: "30px",
          opacity: isAnimating ? 1 : 0,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          height: "50%",
          width: "50%",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "15px",
            right: "15px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "20px",
            color: "#092C4C",
            zIndex: 1100,
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

        {/* Modal content */}
        <div style={{ marginTop: "10px" }}>
          {children}
        </div>
      </div>
    </>
  );

  const root = document.getElementById("modal-root") as HTMLElement | null;
  return root ? createPortal(modalContent, root) : null;
};

export default Modal;