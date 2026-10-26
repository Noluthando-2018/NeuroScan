import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import ResultCard from "../components/ResultCard";
import VisitTimeline from "../components/VisitTimeline";
import { useVisits } from "../hooks/useVisits";
import { filterTc, validateTc } from "../utils/validators";
import { friendlyDbError } from "../utils/auth";
import { conditionOf, CONDITIONS, ALZHEIMER_DATA, PATIENT_CARDS } from "../data/conditions";

export default function PatientDashboard({ nav, session, data, toast }) {
  const [cases, setCases]           = useState([]);        // every case linked to this patient
  const [selectedId, setSelectedId] = useState(null);
  const [vis, setVis]               = useState(null);
  const [hasTc, setHasTc]           = useState(null);      // null = unknown (database functions missing)
  const [tcInput, setTcInput]       = useState("");
  const [linking, setLinking]       = useState(false);
  const [linkError, setLinkError]   = useState("");
  const [chatOpen, setChatOpen]     = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: "bot", text: "Hello! I'm your NeuroScan assistant. I can answer general questions about your scan results. How can I help?" }
  ]);
  const [chatInput, setChatInput]   = useState("");
  const [loading, setLoading]       = useState(true);

  const selectedCase = cases.find(c => c.id === selectedId) ?? cases[0] ?? null;
  const condition    = conditionOf(selectedCase);
  const isAlz        = condition === "alzheimer";
  const { visits } = useVisits(selectedCase?.id, { withResults: false });

  useEffect(() => { if (session) loadPatientData(); }, [session]);

  // Loads every case linked to this patient. First it links any new case that matches the T.C. the patient registered.
  const loadPatientData = async () => {
    setLoading(true);

    const { error: syncErr } = await supabase.rpc("sync_my_cases");
    if (syncErr) console.warn("sync_my_cases failed:", syncErr.message);

    const { data: status, error: statusErr } = await supabase.rpc("get_my_tc_status");
    setHasTc(statusErr ? null : !!status?.has_tc);

    const { data: list, error: listErr } = await supabase
      .from("cases").select("*")
      .eq("patient_id", session.user.id)
      .order("created_at", { ascending: false });
    if (listErr) console.error("Failed to load cases:", listErr.message);

    setCases(list ?? []);
    setLoading(false);
  };

  // What the doctor has released for the selected case.
  useEffect(() => {
    if (!selectedCase?.id) { setVis(null); return; }
    let cancelled = false;
    supabase.from("patient_visibility").select("*").eq("case_id", selectedCase.id).maybeSingle()
      .then(({ data: visData }) => { if (!cancelled) setVis(visData ?? null); });
    return () => { cancelled = true; };
  }, [selectedCase?.id]);

  // The patient enters their T.C. once; every matching case is linked automatically.
  const registerTc = async () => {
    const validationError = validateTc(tcInput);
    if (validationError) { setLinkError(validationError); return; }
    setLinking(true); setLinkError("");

    const { data: res, error: rpcErr } = await supabase.rpc("claim_tc_and_link", { p_tc: tcInput.trim() });
    if (rpcErr) {
      console.error("claim_tc_and_link failed:", rpcErr.message);
      setLinkError(friendlyDbError(rpcErr.message));
      setLinking(false); return;
    }
    setTcInput("");   // do not keep the T.C. in memory longer than needed
    await loadPatientData();
    setLinking(false);

    const n = res?.linked ?? 0;
    if (n > 0) toast.success("Cases linked!", `${n} case${n > 1 ? "s were" : " was"} linked to your account automatically.`);
    else toast.success("T.C. Kimlik No saved", "Your results will appear automatically once your doctor adds your scan.");
  };

  const faqResponses = {
    "glioblastoma": "Glioblastoma is a type of brain tumor. Your doctor is the best person to explain what this means for your situation.",
    "idh":          "IDH is a genetic marker that helps doctors understand the tumor. Ask your doctor what it means for your care.",
    "mgmt":         "MGMT is a gene marker that can affect how certain treatments work. Your doctor will explain this.",
    "treatment":    "Treatment options depend on many factors. Your doctor will review results and recommend the best plan.",
    "mri":          "MRI creates detailed brain pictures without radiation. It's a non-invasive, safe scan.",
    "grade":        "Tumor grade describes how abnormal the cells look and how fast they may grow.",
    "alzheimer":    "Alzheimer's disease is a condition that gradually affects memory and thinking. Your doctor is the best person to explain what your results mean for you.",
    "hippocampus":  "The hippocampus is a brain area that is important for forming new memories. Its size is one of the measurements the AI looks at.",
    "memory":       "Changes in memory-related brain areas can be seen on MRI. Your doctor will explain what your scan means.",
    "stage":        "The stage describes how far changes have progressed. Your doctor will explain what this means for you.",
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

  // No case linked yet.
  if (!selectedCase) return (
    <div className="page">
      <div className="page-header">
        <div><h2>My MRI Results</h2><p className="subtitle">Your results appear here automatically</p></div>
      </div>
      <div style={{ maxWidth: 480, margin: "40px auto" }}>
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--accent-dim)", border: "2px solid var(--accent-mid)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 16px", color: "var(--accent)"
            }}>{hasTc ? "⏳" : "🪪"}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              {hasTc ? "No results yet" : "Enter your T.C. Kimlik No"}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
              {hasTc
                ? "Your T.C. Kimlik No is registered. As soon as your doctor adds your MRI, it is linked to your account automatically and shows up here."
                : "Enter your T.C. Kimlik No once. Every MRI case your doctor has saved for you is linked to your account automatically, including future ones."}
            </p>
          </div>

          {hasTc ? (
            <button className="btn-primary full-width" onClick={loadPatientData}>↻ Check for new results</button>
          ) : (
            <>
              <div className="form-group">
                <label>T.C. Kimlik No</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="11-digit T.C. Kimlik No"
                  value={tcInput}
                  onChange={e => { setTcInput(filterTc(e.target.value)); setLinkError(""); }}
                  onKeyDown={e => e.key === "Enter" && registerTc()}
                  style={{ textAlign: "center", fontSize: 18, fontFamily: "var(--mono)", letterSpacing: 2 }}
                />
              </div>

              {linkError && (
                <div className="auth-error" style={{ marginBottom: 16 }}>⚠ {linkError}</div>
              )}

              <button className="btn-primary full-width" onClick={registerTc} disabled={linking}>
                {linking ? "Linking…" : "Link My Results →"}
              </button>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, textAlign: "center", lineHeight: 1.6 }}>
                Your T.C. Kimlik No is stored securely and is only used to match your cases. It cannot be changed afterwards.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const cond      = CONDITIONS[condition];
  const cards     = PATIENT_CARDS[condition];
  const alz       = ALZHEIMER_DATA;
  const confidence = isAlz ? alz.probabilities[0].value : data?.probabilities?.[0]?.value;
  const xai       = isAlz ? alz.xaiFeatures : data?.xaiFeatures;

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>My MRI Results</h2><p className="subtitle">A simplified overview of your brain scan analysis</p></div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          background: "var(--accent-dim)", border: "1px solid var(--accent-mid)",
          borderRadius: "var(--radius)", padding: "6px 14px", fontSize: 13
        }}>
          <span className={`badge ${cond.badge}`}>{cond.icon} {cond.short}</span>
          {cases.length > 1 ? (
            <select value={selectedCase.id} onChange={e => setSelectedId(e.target.value)}
              style={{ padding: "4px 8px", fontSize: 13, width: "auto" }}>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.scan_date ?? "—"} · {CONDITIONS[conditionOf(c)].short}
                </option>
              ))}
            </select>
          ) : (
            <>
              <span style={{ color: "var(--text-muted)" }}>Case</span>
              <code style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--accent-dark)" }}>{selectedCase.id}</code>
            </>
          )}
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
          {Object.entries(cards).map(([key, c]) => vis?.[key] && (
            <ResultCard key={key} icon={c.icon} title={c.title} text={c.text} />
          ))}
        </div>
      )}

      {vis?.tumor_type && (isAlz || data) && (
        <div className="card patient-clinical-card">
          <h3>{isAlz ? "🧩 Diagnosis & Stage" : "🔬 Tumor Classification"}</h3>
          <p className="hint">{isAlz ? "The AI system suggests the following:" : "The AI system identified the following tumor type:"}</p>
          <div className="patient-tumor-display">
            <span className="patient-tumor-name">{isAlz ? alz.diagnosis : data.tumorType}</span>
            <span className="patient-tumor-conf">{confidence}% AI confidence</span>
          </div>
          {isAlz && <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 10 }}>Estimated stage: <strong>{alz.stage}</strong></p>}
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>Your doctor will confirm and explain this result.</p>
        </div>
      )}

      {!isAlz && vis?.survival_estimate && data && (
        <div className="card patient-clinical-card patient-sensitive-card">
          <h3>⏳ Prognosis Information</h3>
          <p className="hint">A statistical estimate based on imaging data. Individual outcomes vary widely.</p>
          <div className="patient-survival-display">{data.survival}</div>
          <p style={{ fontSize: 13, color: "var(--warning)", marginTop: 12 }}>⚠️ Please discuss this with your doctor before drawing any conclusions.</p>
        </div>
      )}

      {vis?.clinical_markers && (isAlz || data) && (
        <div className="card patient-clinical-card">
          <h3>{isAlz ? "🧬 Brain Biomarkers" : "🧬 Biological Markers"}</h3>
          <p className="hint">{isAlz ? "Measurements taken from your scan:" : "Genetic and molecular markers from your scan analysis:"}</p>
          <div className="patient-markers-grid">
            {isAlz
              ? alz.markers.map((m, i) => <div key={i} className="patient-marker"><span>{m.label}</span><strong>{m.value}</strong></div>)
              : (<>
                  <div className="patient-marker"><span>Grade</span><strong>{data.grade}</strong></div>
                  <div className="patient-marker"><span>IDH Status</span><strong>{data.idh}</strong></div>
                  <div className="patient-marker"><span>MGMT Promoter</span><strong>{data.mgmt}</strong></div>
                </>)}
          </div>
        </div>
      )}

      {vis?.xai_explanation && xai && (
        <div className="card patient-clinical-card">
          <h3>🤖 How the AI Made Its Decision</h3>
          <p className="hint">Factors the AI considered when analyzing your scan:</p>
          {xai.map((f, i) => (
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
