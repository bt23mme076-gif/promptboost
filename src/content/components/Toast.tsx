import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ message, type, duration = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  const icon = { success: "✓", error: "✗", info: "ℹ" }[type];

  return (
    <div
      className={`pb-toast pb-toast-${type} pb-slide-up`}
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        pointerEvents: "none",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "15px" }}>{icon}</span>
      <span>{message}</span>
    </div>
  );
}
