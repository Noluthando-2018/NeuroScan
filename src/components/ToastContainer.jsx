import React from "react";

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
      pointerEvents: "none"
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          pointerEvents: "all",
          background: t.type === "success" ? "var(--success)" : t.type === "error" ? "var(--danger)" : t.type === "warning" ? "var(--warning)" : "var(--accent)",
          color: "#fff",
          padding: "14px 18px",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          display: "flex", alignItems: "flex-start", gap: 12,
          minWidth: 300, maxWidth: 400,
          animation: "slideInRight 0.3s ease",
          fontSize: 14,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>
            {t.type === "success" ? "✓" : t.type === "error" ? "✕" : t.type === "warning" ? "⚠" : "ℹ"}
          </span>
          <div style={{ flex: 1 }}>
            {t.title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.title}</div>}
            <div style={{ opacity: 0.92, fontSize: 13, lineHeight: 1.4 }}>{t.message}</div>
          </div>
          <button onClick={() => removeToast(t.id)} style={{
            background: "none", border: "none", color: "#fff",
            cursor: "pointer", opacity: 0.7, fontSize: 16, padding: 0, flexShrink: 0
          }}>✕</button>
        </div>
      ))}
    </div>
  );
}

