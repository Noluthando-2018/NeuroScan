import { useState } from "react";

const RISK_ORDER = { Low: 1, Moderate: 2, High: 3 };
const riskBadge  = r => ({ High: "badge-red", Moderate: "badge-orange", Low: "badge-green" }[r] || "badge-blue");

const fmtDate = d =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function RiskTrend({ prev, current }) {
  if (!prev || !current || !RISK_ORDER[prev] || !RISK_ORDER[current]) return null;
  const diff = RISK_ORDER[current] - RISK_ORDER[prev];
  if (diff === 0) return <span className="timeline-trend same">→ Risk unchanged</span>;
  return diff > 0
    ? <span className="timeline-trend up">↑ Risk increased</span>
    : <span className="timeline-trend down">↓ Risk decreased</span>;
}

/**
 * visits    – array ordered oldest → newest
 * results   – { [visitId]: analysis_results row }
 * readOnly  – patient view: hides AI results, risk and doctor notes
 */
export default function VisitTimeline({
  visits, results = {}, selectedId, onSelect, onAddVisit, onSaveNotes, readOnly = false,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft]         = useState("");
  const [saving, setSaving]       = useState(false);

  const items = visits.map((v, i) => ({ ...v, number: i + 1, prev: visits[i - 1] })).reverse(); // newest first

  const startEdit = (v) => { setEditingId(v.id); setDraft(v.notes ?? ""); };
  const saveEdit  = async (v) => {
    setSaving(true);
    const ok = await onSaveNotes?.(v.id, draft.trim());
    setSaving(false);
    if (ok) setEditingId(null);
  };

  return (
    <div className="card">
      <div className="timeline-head">
        <div>
          <h3>{readOnly ? "My Visit History" : "Visit History"}</h3>
          <p className="hint">
            {visits.length === 0
              ? "No visits recorded yet."
              : `${visits.length} visit${visits.length > 1 ? "s" : ""} · first scan ${fmtDate(visits[0].visit_date)}`}
          </p>
        </div>
        {!readOnly && onAddVisit && (
          <button className="btn-primary" onClick={onAddVisit}>➕ Add Follow-up Visit</button>
        )}
      </div>

      {visits.length > 0 && (
        <ol className="timeline">
          {items.map((v, idx) => {
            const r      = results[v.id];
            const gap    = v.prev ? daysBetween(v.prev.visit_date, v.visit_date) : null;
            const isLast = idx === 0;
            return (
              <li key={v.id} className={`timeline-item ${selectedId === v.id ? "selected" : ""}`}>
                <div className="timeline-dot">{v.number}</div>
                <div className="timeline-body">
                  <div className="timeline-top">
                    <strong>Visit #{v.number}</strong>
                    {v.number === 1 && <span className="badge badge-blue">Baseline</span>}
                    {isLast && visits.length > 1 && <span className="badge badge-green">Latest</span>}
                    <span className="timeline-date">{fmtDate(v.visit_date)}</span>
                    {gap !== null && <span className="timeline-gap">+{gap} days since Visit #{v.number - 1}</span>}
                  </div>

                  <div className="timeline-meta">
                    <span className={`badge ${v.status === "Done" ? "badge-green" : "badge-blue"}`}>{v.status}</span>
                    {!readOnly && v.risk && <span className={`badge ${riskBadge(v.risk)}`}>{v.risk} risk</span>}
                    {!readOnly && <RiskTrend prev={v.prev?.risk} current={v.risk} />}
                    {!readOnly && r && <span className="timeline-result">{r.tumor_type} · {r.grade}</span>}
                  </div>

                  {!readOnly && (
                    editingId === v.id ? (
                      <div style={{ marginTop: 10 }}>
                        <textarea className="doctor-note-input" rows={3} value={draft}
                          placeholder="Clinical note for this visit…"
                          onChange={e => setDraft(e.target.value)} />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button className="btn-sm" disabled={saving} onClick={() => saveEdit(v)}>
                            {saving ? "Saving…" : "✓ Save note"}
                          </button>
                          <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 12 }}
                            onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="timeline-notes">
                        {v.notes
                          ? <p>📝 {v.notes}</p>
                          : <p className="timeline-notes-empty">No note for this visit.</p>}
                        <button className="timeline-link" onClick={() => startEdit(v)}>
                          {v.notes ? "Edit note" : "+ Add note"}
                        </button>
                      </div>
                    )
                  )}

                  {!readOnly && onSelect && (
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-sm" onClick={() => onSelect(v)}>
                        {selectedId === v.id ? "✓ Selected — open scans" : "View this visit"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
