import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ImageModalProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImageModal({ src, alt = "Image", onClose }: ImageModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (src) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [src, handleKeyDown]);

  if (!src) return null;

  const modal = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0, 0, 0, 0.95)",
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: "zoom-out",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "none",
          background: "rgba(255, 255, 255, 0.15)",
          color: "white",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100000,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        <X size={24} />
      </button>
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: "calc(100vw - 48px)",
          maxHeight: "calc(100vh - 48px)",
          objectFit: "contain",
          cursor: "default",
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );

  return createPortal(modal, document.body);
}
