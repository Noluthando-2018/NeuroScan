import React from "react";

export default function ResultCard({ icon, title, text }) {
  return (
    <div className="result-card card">
      <div className="result-icon">{icon}</div>
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  );
}


