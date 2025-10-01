import React from "react";
import { FaTimes } from "react-icons/fa";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose} // background click closes
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside content
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: "8px",
          width: "60%",   // wide modal
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "20px",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "15px",
            right: "25px",
            background: "transparent",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          <FaTimes />
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
