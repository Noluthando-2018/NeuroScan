import { useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../supabaseClient";
import Brain3DViewer from "../features/Brain3DViewer";
import MarkerItem from "../components/MarkerItem";
import VisitTimeline from "../components/VisitTimeline";
import { useVisits } from "../hooks/useVisits";

export default function DoctorDashboard({ patient, data, nav, session, patientVisibility, setPatientVisibility, toast, onAddVisit }) {
  const [activeTab, setActiveTab] = useState("results");
  const [saving, setSaving]       = useState(false);
  const [savedOk, setSavedOk]     = useState(false);

  // ── Visits ────────────────────────────────────────────────────────────────
  const { visits, results: visitResults, loading: visitsLoading, refresh: refreshVisits } = useVisits(patient.id);
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const selectedVisit = visits.find(v => v.id === selectedVisitId) ?? visits[visits.length - 1] ?? null; // default: latest
  const visitNumber   = selectedVisit ? visits.indexOf(selectedVisit) + 1 : null;
  const visitLabel    = visitNumber ? `Visit #${visitNumber}` : null;

  const saveVisitNotes = async (visitId, notes) => {
    const { error } = await supabase.from("visits").update({ notes }).eq("id", visitId);
    if (error) { toast.error("Save failed", error.message); return false; }
    toast.success("Note saved", "The visit note has been updated.");
    await refreshVisits();
    return true;
  };

  const toggleVis  = (key) => { setPatientVisibility(v => ({ ...v, [key]: !v[key] })); setSavedOk(false); };
  const updateNote = (val) => { setPatientVisibility(v => ({ ...v, doctor_note: val })); setSavedOk(false); };

  const saveVisibility = async () => {
    setSaving(true);
    const { error } = await supabase.from("patient_visibility").upsert({
      case_id: patient.id, doctor_id: session.user.id,
      ...patientVisibility,
      updated_at: new Date().toISOString(),
    }, { onConflict: "case_id" });
    setSaving(false);
    if (!error) {
      setSavedOk(true);
      toast.success("Visibility saved!", "Patient dashboard has been updated successfully.");
    } else {
      toast.error("Save failed", error.message);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("NeuroScan — Clinical Report", 20, 20);
    doc.setFontSize(11);
    doc.text(`Case ID: ${patient.id}`, 20, 35);
    doc.text(`Patient: ${patient.patient_name}  |  Age: ${patient.age}  |  Sex: ${patient.sex}`, 20, 43);
    doc.text(`Scan Date: ${selectedVisit?.visit_date ?? patient.scan_date}`, 20, 51);
    if (visitNumber) doc.text(`Visit: #${visitNumber} of ${visits.length}`, 120, 51);
    doc.line(20, 56, 190, 56);
    doc.setFontSize(14); doc.text("AI Prediction Results", 20, 65);
    doc.setFontSize(11);
    doc.text(`Tumor Type: ${data.tumorType}`, 20, 75);
    doc.text(`Grade: ${data.grade}`, 20, 83);
    doc.text(`IDH: ${data.idh}`, 20, 91);
    doc.text(`MGMT: ${data.mgmt}`, 20, 99);
    doc.setFontSize(9); doc.setTextColor(150);
    doc.text("AI-assisted report. Must be reviewed by a qualified physician.", 20, 240);
    doc.save(`NeuroScan_Case_${patient.id}_Report.pdf`);
  };

  const VISIBILITY_OPTIONS = [
    { key: "scan_findings",            label: "Scan Findings",            desc: "General description of detected region",   category: "basic"     },
    { key: "growth_pattern",           label: "Growth Pattern",           desc: "Tumor growth characteristics",             category: "basic"     },
    { key: "treatment_considerations", label: "Treatment Considerations", desc: "General treatment info",                   category: "basic"     },
    { key: "surgical_assessment",      label: "Surgical Assessment",      desc: "Resectability and surgery info",            category: "clinical"  },
    { key: "next_steps",               label: "Next Steps",               desc: "Follow-up and appointment guidance",        category: "basic"     },
    { key: "tumor_type",               label: "Tumor Type & Name",        desc: "AI-predicted tumor classification",         category: "clinical"  },
    { key: "clinical_markers",         label: "Clinical Markers",         desc: "IDH, MGMT, tumor grade",                   category: "clinical"  },
    { key: "xai_explanation",          label: "AI Explanation (XAI)",     desc: "Feature importance chart",                  category: "clinical"  },
  ];

  const categoryColor = { basic: "badge-green", clinical: "badge-blue", sensitive: "badge-red" };
  const categoryLabel = { basic: "Basic", clinical: "Clinical", sensitive: "Sensitive" };
  const vis = patientVisibility || {};

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>Case Results — {patient.id}</h2><p className="subtitle">AI-assisted analysis report</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={() => nav("doctorSelect")}>⬅ Back</button>
          <button className="btn-primary" onClick={generatePDF}>📄 Export PDF</button>
        </div>
      </div>

      <div className="patient-bar card">
        <div className="patient-field"><label>Name</label><strong>{patient.patient_name}</strong></div>
        <div className="patient-field"><label>Age</label><strong>{patient.age}</strong></div>
        <div className="patient-field"><label>Sex</label><strong>{patient.sex}</strong></div>
        <div className="patient-field"><label>Scan Date</label><strong>{selectedVisit?.visit_date ?? patient.scan_date}</strong></div>
        <div className="patient-field"><label>Risk</label>
          <span className={`badge ${(selectedVisit?.risk ?? patient.risk) === "High" ? "badge-red" : (selectedVisit?.risk ?? patient.risk) === "Moderate" ? "badge-orange" : "badge-green"}`}>
            {selectedVisit?.risk ?? patient.risk ?? "Pending"}
          </span>
        </div>
      </div>

      {visits.length > 1 && (
        <div className="visit-picker">
          <span>📅 Viewing:</span>
          <select value={selectedVisit?.id ?? ""} onChange={e => setSelectedVisitId(e.target.value)}>
            {visits.map((v, i) => (
              <option key={v.id} value={v.id}>Visit #{i + 1} — {v.visit_date}{i === visits.length - 1 ? " (latest)" : ""}</option>
            ))}
          </select>
        </div>
      )}

      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === "results" ? "active" : ""}`}    onClick={() => setActiveTab("results")}>🔬 AI Results</button>
        <button className={`tab-btn ${activeTab === "viewer" ? "active" : ""}`}     onClick={() => setActiveTab("viewer")}>🧠 3D Brain Viewer</button>
        <button className={`tab-btn ${activeTab === "visits" ? "active" : ""}`}     onClick={() => setActiveTab("visits")}>
          📅 Visit History <span className="badge badge-blue" style={{ marginLeft: 6 }}>{visits.length}</span>
        </button>
        <button className={`tab-btn ${activeTab === "visibility" ? "active" : ""}`} onClick={() => setActiveTab("visibility")}>
          👁 Patient Visibility {savedOk && <span className="tab-saved-badge">Saved</span>}
        </button>
      </div>

      {activeTab === "visits" && (
        <VisitTimeline
          visits={visits} results={visitResults} selectedId={selectedVisit?.id}
          onSelect={(v) => { setSelectedVisitId(v.id); setActiveTab("viewer"); }}
          onAddVisit={onAddVisit}
          onSaveNotes={saveVisitNotes}
        />
      )}

      {activeTab === "viewer" && !visitsLoading && (
        <Brain3DViewer
          key={selectedVisit?.id ?? "legacy"}
          caseId={patient.id} visitId={selectedVisit?.id} visitLabel={visitLabel} session={session}
        />
      )}

      {activeTab === "results" && (<>
        <div className="results-grid">
          <div className="card">
            <h3>Tumor Prediction</h3>
            <div className="tumor-type-display">
              <span className="tumor-name">{data.tumorType}</span>
              <span className="tumor-prob">{data.probabilities[0].value}% confidence</span>
            </div>
            <div className="prob-bars">
              {data.probabilities.map((p, i) => (
                <div key={i} className="prob-row">
                  <span className="prob-label">{p.name}</span>
                  <div className="prob-bar-bg"><div className="prob-bar-fill" style={{ width: `${p.value}%`, opacity: i === 0 ? 1 : 0.6 - i * 0.15 }} /></div>
                  <span className="prob-pct">{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Clinical Markers</h3>
            <div className="marker-grid">
              <MarkerItem label="Grade"            value={data.grade}    alert />
              <MarkerItem label="IDH Status"       value={data.idh}            />
              <MarkerItem label="MGMT Promoter"    value={data.mgmt}           />
            </div>
          </div>
          <div className="card xai-card">
            <h3>Explainable AI — Feature Importance</h3>
            <p className="hint">Features contributing most to the AI prediction:</p>
            {data.xaiFeatures.map((f, i) => (
              <div key={i} className="xai-row">
                <span className="xai-label">{f.name}</span>
                <div className="xai-bar-bg"><div className="xai-bar-fill" style={{ width: `${f.importance}%` }} /></div>
                <span className="xai-pct">{f.importance}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="warning-banner">
          ⚠️ <strong>Important:</strong> This output is AI-assisted and must be reviewed by a qualified physician before clinical use.
        </div>
      </>)}

      {activeTab === "visibility" && (
        <div>
          <div className="card">
            <h3>Patient View Controls</h3>
            <p className="hint" style={{ marginBottom: 20 }}>Choose what this patient can see on their dashboard. Click Save to apply changes.</p>
            <div className="vis-legend">
              <span className="badge badge-green">Basic</span> Safe for all patients &nbsp;
              <span className="badge badge-blue">Clinical</span> Use discretion &nbsp;
              <span className="badge badge-red">Sensitive</span> Share carefully
            </div>
            <div className="vis-options-grid">
              {VISIBILITY_OPTIONS.map(opt => (
                <div key={opt.key} className={`vis-option ${vis[opt.key] ? "vis-on" : "vis-off"}`} onClick={() => toggleVis(opt.key)}>
                  <div className="vis-option-top">
                    <span className={`badge ${categoryColor[opt.category]}`}>{categoryLabel[opt.category]}</span>
                    <div className={`vis-toggle ${vis[opt.key] ? "on" : ""}`}><div className="vis-thumb" /></div>
                  </div>
                  <div className="vis-option-label">{opt.label}</div>
                  <div className="vis-option-desc">{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Doctor's Note to Patient</h3>
            <p className="hint">This message appears at the top of the patient's dashboard.</p>
            <textarea className="doctor-note-input" rows={5}
              placeholder="e.g. 'Hello, I have reviewed your MRI results. We will discuss everything at your appointment on June 3rd.'"
              value={vis.doctor_note || ""}
              onChange={e => updateNote(e.target.value)}
            />
          </div>
          <div className="vis-save-bar">
            <div className="vis-summary">
              <strong>{VISIBILITY_OPTIONS.filter(o => vis[o.key]).length}</strong> of {VISIBILITY_OPTIONS.length} sections visible to patient
            </div>
            <button className="btn-primary" onClick={saveVisibility} disabled={saving}>
              {saving ? "Saving…" : "✓ Save Patient View"}
            </button>
            {savedOk && <span className="saved-confirm">✓ Saved to database</span>}
          </div>
        </div>
      )}
    </div>
  );
}

