import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import ResultCard from "../components/ResultCard";
import VisitTimeline from "../components/VisitTimeline";
import { useVisits } from "../hooks/useVisits";
import { filterCaseId, filterTc, validateCaseId, validateTc, firstError } from "../utils/validators";

// Maps database error codes raised by link_case_with_tc to readable messages.
function friendlyLinkError(message = "") {
  if (message.includes("no_match"))          return "Case ID and T.C. Kimlik No do not match. Please check the details.";
  if (message.includes("already_linked"))    return "This case is already linked to another patient account.";
  if (message.includes("invalid_tc"))        return "Please enter a valid T.C. Kimlik No.";
  if (message.includes("case_not_found"))    return "Case not found.";
  if (message.includes("not_authenticated")) return "Your session has expired. Please log in again.";
  if (message.includes("does not exist"))    return "Database functions are not installed (link_case_with_tc). Run the SQL setup first.";
  return "Failed to link case. Please try again.";
}

export default function PatientDashboard({ nav, session, data, toast }) {
  const [vis, setVis]               = useState(null);
  const [linkedCase, setLinkedCase] = useState(null);
  const [caseIdInput, setCaseIdInput] = useState("");
  const [tcInput, setTcInput]       = useState("");
  const [linking, setLinking]       = useState(false);
  const [linkError, setLinkError]   = useState("");
  const [chatOpen, setChatOpen]     = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: "bot", text: "Hello! I'm your NeuroScan assistant. I can answer general questions about your scan results. How can I help?" }
  ]);
  const [chatInput, setChatInput]   = useState("");
  const [loading, setLoading]       = useState(true);
  const { visits } = useVisits(linkedCase?.id, { withResults: false });

  useEffect(() => { if (session) loadPatientData(); }, [session]);

  const loadPatientData = async () => {
    const { data: caseData } = await supabase
      .from("cases").select("id, patient_name, scan_date, status")
      .eq("patient_id", session.user.id)
      .order("created_at", { ascending: false }).limit(1).single();

    if (caseData) {
      setLinkedCase(caseData);
      const { data: visData } = await supabase
        .from("patient_visibility").select("*").eq("case_id", caseData.id).single();
      if (visData) setVis(visData);
    }
    setLoading(false);
  };

  const linkWithCaseId = async () => {
    const input = caseIdInput.trim().toUpperCase();
    const tc    = tcInput.trim();
    const validationError = firstError(validateCaseId(input), validateTc(tc));
    if (validationError) { setLinkError(validationError); return; }
    setLinking(true); setLinkError("");

    // The database verifies Case ID + T.C. Kimlik No together and links the case to this account.
    const { data: caseData, error: rpcErr } = await supabase.rpc("link_case_with_tc", { p_case_id: input, p_tc: tc });

    if (rpcErr || !caseData) {
      if (rpcErr) console.error("link_case_with_tc failed:", rpcErr.message);
      setLinkError(friendlyLinkError(rpcErr?.message));
      setLinking(false); return;
    }
    setTcInput("");   // do not keep the T.C. in memory longer than needed

    // Load visibility
    const { data: visData } = await supabase
      .from("patient_visibility").select("*").eq("case_id", input).single();

    setLinkedCase(caseData);
    if (visData) setVis(visData);
    setLinking(false);
    toast.success("Case linked!", "Your MRI results are now available.");
  };

  const faqResponses = {
    "glioblastoma": "Glioblastoma is a type of brain tumor. Your doctor is the best person to explain what this means for your situation.",
    "idh":          "IDH is a genetic marker that helps doctors understand the tumor. Ask your doctor what it means for your care.",
    "mgmt":         "MGMT is a gene marker that can affect how certain treatments work. Your doctor will explain this.",
    "treatment":    "Treatment options depend on many factors. Your doctor will review results and recommend the best plan.",
    "mri":          "MRI creates detailed brain pictures without radiation. It's a non-invasive, safe scan.",
    "grade":        "Tumor grade describes how abnormal the cells look and how fast they may grow.",
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages(m => [...m, { role: "user", text: chatInput }]);
    const lower = chatInput.toLowerCase();
    let reply = "That's a great question. I recommend discussing this with your doctor for personalised information.";
    for (const [key, val] of Object.entries(faqResponses)) {
      if (lower.includes(key)) { reply = val; break; }
    }
    setChatInput("");
    setTimeout(() => setChatMessages(m => [...m, { role: "bot", text: reply }]), 600);
  };

  if (loading) return <div className="page"><div className="empty-state"><p>Loading your results…</p></div></div>;

  const visibleCount = vis
    ? ["scan_findings","growth_pattern","treatment_considerations","surgical_assessment",
       "next_steps","tumor_type","clinical_markers","xai_explanation"]
        .filter(k => vis[k]).length
    : 0;

  // No case linked yet — show Case ID entry
  if (!linkedCase) return (
    <div className="page">
      <div className="page-header">
        <div><h2>My MRI Results</h2><p className="subtitle">Enter your Case ID and T.C. Kimlik No to view your results</p></div>
      </div>
      <div style={{ maxWidth: 480, margin: "40px auto" }}>
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--accent-dim)", border: "2px solid var(--accent-mid)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 16px", color: "var(--accent)"
            }}>🏥</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              Link Your MRI Case
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
              Your doctor will give you a Case ID after your MRI analysis is complete.
              Enter it below together with your T.C. Kimlik No to access your results.
            </p>
          </div>

          <div className="form-group">
            <label>Case ID</label>
            <input
              type="text"
              placeholder="e.g. C928348"
              value={caseIdInput}
              onChange={e => { setCaseIdInput(filterCaseId(e.target.value)); setLinkError(""); }}
              onKeyDown={e => e.key === "Enter" && linkWithCaseId()}
              autoComplete="off"
              style={{ textAlign: "center", fontSize: 20, fontFamily: "var(--mono)", letterSpacing: 2, fontWeight: 700 }}
            />
          </div>

          <div className="form-group">
            <label>T.C. Kimlik No</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="11-digit T.C. Kimlik No"
              value={tcInput}
              onChange={e => { setTcInput(filterTc(e.target.value)); setLinkError(""); }}
              onKeyDown={e => e.key === "Enter" && linkWithCaseId()}
              style={{ textAlign: "center", fontSize: 18, fontFamily: "var(--mono)", letterSpacing: 2 }}
            />
          </div>

          {linkError && (
            <div className="auth-error" style={{ marginBottom: 16 }}>⚠ {linkError}</div>
          )}

          <button className="btn-primary full-width" onClick={linkWithCaseId} disabled={linking}>
            {linking ? "Linking…" : "Access My Results →"}
          </button>

          <div style={{
            marginTop: 20, padding: "12px 16px",
            background: "var(--bg-alt)", borderRadius: "var(--radius)",
            border: "1px solid var(--border)"
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              Where do I find my Case ID?
            </div>
            <ul style={{ fontSize: 13, color: "var(--text-muted)", paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
              <li>Your doctor will provide it after uploading your MRI scans</li>
              <li>It starts with the letter C followed by numbers (e.g. C928348)</li>
              <li>Contact your doctor if you haven't received it yet</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>My MRI Results</h2><p className="subtitle">A simplified overview of your brain scan analysis</p></div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--accent-dim)", border: "1px solid var(--accent-mid)",
          borderRadius: "var(--radius)", padding: "6px 14px", fontSize: 13
        }}>
          <span style={{ color: "var(--text-muted)" }}>Case</span>
          <code style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--accent-dark)" }}>
            {linkedCase.id}
          </code>
        </div>
      </div>

      {vis?.doctor_note && (
        <div className="doctor-note-banner card">
          <div className="doctor-note-header"><span>👨‍⚕️</span><strong>Message from your Doctor</strong></div>
          <p>{vis.doctor_note}</p>
        </div>
      )}

      <div className="patient-notice card">
        <span className="notice-icon">ℹ️</span>
        <p>This report is based on computer-assisted MRI analysis. <strong>Only your doctor can interpret these results and make clinical decisions.</strong></p>
      </div>

      {visibleCount === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <p>Your doctor has not yet released your results. You will be notified when they are available.</p>
        </div>
      )}

      {visibleCount > 0 && (
        <div className="patient-results-grid">
          {vis?.scan_findings            && <ResultCard icon="🧠" title="Scan Findings"            text="An abnormal region was detected in your MRI scan. The AI has analyzed this region to help your medical team." />}
          {vis?.growth_pattern           && <ResultCard icon="📈" title="Growth Pattern"           text="Based on imaging features, the detected region may belong to a faster-developing group. Your doctor will discuss this." />}
          {vis?.treatment_considerations && <ResultCard icon="💊" title="Treatment Considerations" text="Some treatments may be more or less effective based on imaging findings. Your doctor will outline the best options." />}
          {vis?.surgical_assessment      && <ResultCard icon="🏥" title="Surgical Assessment"      text="A significant portion of the affected area may be accessible for surgical intervention. Your team will evaluate this." />}
          {vis?.next_steps               && <ResultCard icon="⏳" title="Next Steps"               text="Your doctor will explain everything in your upcoming consultation. Please attend all scheduled appointments." />}
        </div>
      )}

      {vis?.tumor_type && data && (
        <div className="card patient-clinical-card">
          <h3>🔬 Tumor Classification</h3>
          <p className="hint">The AI system identified the following tumor type:</p>
          <div className="patient-tumor-display">
            <span className="patient-tumor-name">{data.tumorType}</span>
            <span className="patient-tumor-conf">{data.probabilities[0].value}% AI confidence</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>Your doctor will confirm and explain this result.</p>
        </div>
      )}

      {vis?.survival_estimate && data && (
        <div className="card patient-clinical-card patient-sensitive-card">
          <h3>⏳ Prognosis Information</h3>
          <p className="hint">A statistical estimate based on imaging data. Individual outcomes vary widely.</p>
          <div className="patient-survival-display">{data.survival}</div>
          <p style={{ fontSize: 13, color: "var(--warning)", marginTop: 12 }}>⚠️ Please discuss this with your doctor before drawing any conclusions.</p>
        </div>
      )}

      {vis?.clinical_markers && data && (
        <div className="card patient-clinical-card">
          <h3>🧬 Biological Markers</h3>
          <p className="hint">Genetic and molecular markers from your scan analysis:</p>
          <div className="patient-markers-grid">
            <div className="patient-marker"><span>Grade</span><strong>{data.grade}</strong></div>
            <div className="patient-marker"><span>IDH Status</span><strong>{data.idh}</strong></div>
            <div className="patient-marker"><span>MGMT Promoter</span><strong>{data.mgmt}</strong></div>
          </div>
        </div>
      )}

      {vis?.xai_explanation && data && (
        <div className="card patient-clinical-card">
          <h3>🤖 How the AI Made Its Decision</h3>
          <p className="hint">Factors the AI considered when analyzing your scan:</p>
          {data.xaiFeatures.map((f, i) => (
            <div key={i} className="xai-row">
              <span className="xai-label">{f.name}</span>
              <div className="xai-bar-bg"><div className="xai-bar-fill" style={{ width: `${f.importance}%` }} /></div>
              <span className="xai-pct">{f.importance}%</span>
            </div>
          ))}
        </div>
      )}

      {visits.length > 0 && <VisitTimeline visits={visits} readOnly />}

      <div className="warning-banner">
        ⚠️ This report is not a diagnosis. Only your doctor can interpret these results and recommend treatment.
      </div>

      <div className={`chatbot-container ${chatOpen ? "open" : ""}`}>
        <button className="chatbot-toggle" onClick={() => setChatOpen(o => !o)}>
          {chatOpen ? "✕ Close" : "💬 Ask a Question"}
        </button>
        {chatOpen && (
          <div className="chatbot-panel">
            <div className="chat-header">NeuroScan Assistant</div>
            <div className="chat-messages">
              {chatMessages.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.role}`}>{m.text}</div>
              ))}
            </div>
            <div className="chat-input-row">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Ask about your results…" />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

