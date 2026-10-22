import React from "react";

export default function MarkerItem({ label, value, alert }) {
  return (
    <div className={`marker-item ${alert ? "marker-alert" : ""}`}>
      <div className="marker-label">{label}</div>
      <div className="marker-value">{value}</div>
    </div>
  );
}

