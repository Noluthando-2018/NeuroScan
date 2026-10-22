import React from "react";

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <span style={{ fontSize: 40, color: "var(--accent)" }}>⬡</span>
      <p style={{ marginTop: 16, color: "var(--text-muted)" }}>Loading NeuroScan…</p>
    </div>
  );
}

