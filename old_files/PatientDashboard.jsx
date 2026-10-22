import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import ResultCard from "../components/ResultCard";
import VisitTimeline from "../components/VisitTimeline";
import { useVisits } from "../hooks/useVisits";
import {
  tcFormat,
  validateTc,
  caseIdFormat,
  validateCaseId,
} from "../utils/validators";

export default function PatientDashboard({ session, data, toast }) {
  const [vis, setVis] = useState(null);
  const [linkedCase, setLinkedCase] = useState(null);
  const [caseIdInput, setCaseIdInput] = useState("");
  const [tcInput, setTcInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      text: "Hello! I'm your NeuroScan assistant. I can answer general questions about your scan results. How can I help?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);

  const { visits } = useVisits(linkedCase?.id, {
    withResults: false,
  });

  useEffect(() => {
    if (!session?.user?.id) {
      setLinkedCase(null);
      setVis(null);
      setLoading(false);
      return;
    }

    loadPatientData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const loadPatientData = async () => {
    setLoading(true);

    try {
      const { data: caseData, error: caseError } = await supabase
        .from("cases")
        .select("id, patient_name, scan_date, status")
        .eq("patient_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (caseError) {
        console.error("Failed to load patient case:", caseError);
        setLinkedCase(null);
        setVis(null);
        return;
      }

      if (!caseData) {
        setLinkedCase(null);
        setVis(null);
        return;
      }

      setLinkedCase(caseData);

      const { data: visibilityData, error: visibilityError } =
        await supabase
          .from("patient_visibility")
          .select("*")
          .eq("case_id", caseData.id)
          .maybeSingle();

      if (visibilityError) {
        console.error(
          "Failed to load patient visibility:",
          visibilityError
        );
      }

      setVis(visibilityData ?? null);
    } catch (err) {
      console.error("Error loading patient data:", err);
      setLinkedCase(null);
      setVis(null);
    } finally {
      setLoading(false);
    }
  };

  const linkWithCaseId = async () => {
    const input = caseIdInput.trim().toUpperCase();
    const tc = tcInput.trim();

    const caseIdError = validateCaseId(input);

    if (caseIdError) {
      setLinkError(caseIdError);
      return;
    }

    const tcError = validateTc(tc);

    if (tcError) {
      setLinkError(tcError);
      return;
    }

    if (!session?.user?.id) {
      setLinkError("Your session has expired. Please log in again.");
      return;
    }

    setLinking(true);
    setLinkError("");

    try {
      // The database RPC verifies the Case ID and TC together.
      // Do not directly update patient_id from the frontend.
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "link_case_with_tc",
        {
          p_case_id: input,
          p_tc: tc,
        }
      );

      if (rpcError) {
        console.error("Case linking failed:", rpcError);

        setLinkError(
          "Could not link this case. Check your Case ID and T.C. Kimlik No, then try again."
        );
        return;
      }

      // The RPC may return a row, an object, or a one-row array.
      let returnedCase = Array.isArray(rpcData)
        ? rpcData[0]
        : rpcData;

      // Also support RPC responses that wrap the case in an object.
      if (returnedCase && !returnedCase.id && returnedCase.case) {
        returnedCase = returnedCase.case;
      }

      // If the RPC did not return a case row, fetch the newly linked case.
      if (!returnedCase?.id) {
        const { data: fetchedCase, error: fetchError } = await supabase
          .from("cases")
          .select("id, patient_name, scan_date, status, patient_id, doctor_id")
          .eq("id", input)
          .eq("patient_id", session.user.id)
          .single();

        if (fetchError || !fetchedCase) {
          console.error(
            "Failed to load linked case:",
            fetchError
          );

          setLinkError(
            "The case may have been linked, but its details could not be loaded. Please refresh the page."
          );
          return;
        }

        returnedCase = fetchedCase;
      }

      // Load the visibility settings for the linked case.
      const { data: visibilityData, error: visibilityError } =
        await supabase
          .from("patient_visibility")
          .select("*")
          .eq("case_id", input)
          .maybeSingle();

      if (visibilityError) {
        console.error(
          "Could not load patient visibility:",
          visibilityError
        );
      }

      setLinkedCase(returnedCase);
      setVis(visibilityData ?? null);
      setCaseIdInput("");
      setTcInput("");

      if (toast?.success) {
        toast.success(
          "Case linked!",
          "Your MRI results are now available."
        );
      }
    } catch (err) {
      console.error("Unexpected case-linking error:", err);
      setLinkError("Something went wrong. Please try again.");
    } finally {
      setLinking(false);
    }
  };

  const faqResponses = {
    glioblastoma:
      "Glioblastoma is a type of brain tumor. Your doctor is the best person to explain what this means for your situation.",
    idh:
      "IDH is a genetic marker that helps doctors understand the tumor. Ask your doctor what it means for your care.",
    mgmt:
      "MGMT is a gene marker that can affect how certain treatments work. Your doctor will explain this.",
    treatment:
      "Treatment options depend on many factors. Your doctor will review results and recommend the best plan.",
    mri:
      "MRI creates detailed brain pictures without radiation. It's a non-invasive, safe scan.",
    grade:
      "Tumor grade describes how abnormal the cells look and how fast they may grow.",
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;

    const message = chatInput.trim();

    setChatMessages((current) => [
      ...current,
      { role: "user", text: message },
    ]);

    const lower = message.toLowerCase();

    let reply =
      "That's a great question. I recommend discussing this with your doctor for personalised information.";

    for (const [key, value] of Object.entries(faqResponses)) {
      if (lower.includes(key)) {
        reply = value;
        break;
      }
    }

    setChatInput("");

    setTimeout(() => {
      setChatMessages((current) => [
        ...current,
        { role: "bot", text: reply },
      ]);
    }, 600);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>Loading your results…</p>
        </div>
      </div>
    );
  }

  const visibleCount = vis
    ? [
        "scan_findings",
        "growth_pattern",
        "treatment_considerations",
        "surgical_assessment",
        "next_steps",
        "tumor_type",
        "clinical_markers",
        "xai_explanation",
      ].filter((key) => vis[key]).length
    : 0;

  // No case linked yet: ask for both the Case ID and TC.
  if (!linkedCase) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h2>My MRI Results</h2>
            <p className="subtitle">
              Enter your Case ID and T.C. Kimlik No to view your results
            </p>
          </div>
        </div>

        <div style={{ maxWidth: 480, margin: "40px auto" }}>
          <div className="card">
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--accent-dim)",
                  border: "2px solid var(--accent-mid)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  margin: "0 auto 16px",
                  color: "var(--accent)",
                }}
              >
                🏥
              </div>

              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                Link Your MRI Case
              </h3>

              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                Enter the Case ID provided by your doctor and your T.C.
                Kimlik No to link your MRI case to your account.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="caseId">Case ID</label>
              <input
                id="caseId"
                type="text"
                placeholder="e.g. C7K2M9QX"
                maxLength={12}
                autoComplete="off"
                value={caseIdInput}
                onChange={(event) => {
                  setCaseIdInput(caseIdFormat(event.target.value));
                  setLinkError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !linking) {
                    linkWithCaseId();
                  }
                }}
                style={{
                  textAlign: "center",
                  fontSize: 20,
                  fontFamily: "var(--mono)",
                  letterSpacing: 2,
                  fontWeight: 700,
                }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="patientTc">T.C. Kimlik No</label>
              <input
                id="patientTc"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                placeholder="11-digit T.C. Kimlik No"
                value={tcInput}
                onChange={(event) => {
                  setTcInput(tcFormat(event.target.value));
                  setLinkError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !linking) {
                    linkWithCaseId();
                  }
                }}
              />
            </div>

            {linkError && (
              <div
                className="auth-error"
                style={{ marginBottom: 16 }}
                role="alert"
              >
                ⚠ {linkError}
              </div>
            )}

            <button
              className="btn-primary full-width"
              onClick={linkWithCaseId}
              disabled={linking}
            >
              {linking ? "Linking…" : "Access My Results →"}
            </button>

            <div
              style={{
                marginTop: 20,
                padding: "12px 16px",
                background: "var(--bg-alt)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 8,
                }}
              >
                Where do I find my Case ID?
              </div>

              <ul
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  paddingLeft: 18,
                  margin: 0,
                  lineHeight: 1.8,
                }}
              >
                <li>
                  Your doctor will provide it after uploading your MRI scans.
                </li>
                <li>
                  It starts with the letter C followed by letters and
                  numbers (e.g. C7K2M9QX).
                </li>
                <li>
                  You must also enter the T.C. Kimlik No associated with
                  the case.
                </li>
                <li>
                  Contact your doctor if you have not received your Case ID.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>My MRI Results</h2>
          <p className="subtitle">
            A simplified overview of your brain scan analysis
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-mid)",
            borderRadius: "var(--radius)",
            padding: "6px 14px",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Case</span>
          <code
            style={{
              fontFamily: "var(--mono)",
              fontWeight: 700,
              color: "var(--accent-dark)",
            }}
          >
            {linkedCase.id}
          </code>
        </div>
      </div>

      {vis?.doctor_note && (
        <div className="doctor-note-banner card">
          <div className="doctor-note-header">
            <span>👨‍⚕️</span>
            <strong>Message from your Doctor</strong>
          </div>
          <p>{vis.doctor_note}</p>
        </div>
      )}

      <div className="patient-notice card">
        <span className="notice-icon">ℹ️</span>
        <p>
          This report is based on computer-assisted MRI analysis.{" "}
          <strong>
            Only your doctor can interpret these results and make clinical
            decisions.
          </strong>
        </p>
      </div>

      {visibleCount === 0 && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 48,
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <p>
            Your doctor has not yet released your results. You will be
            notified when they are available.
          </p>
        </div>
      )}

      {visibleCount > 0 && (
        <div className="patient-results-grid">
          {vis?.scan_findings && (
            <ResultCard
              icon="🧠"
              title="Scan Findings"
              text="An abnormal region was detected in your MRI scan. The AI has analyzed this region to help your medical team."
            />
          )}

          {vis?.growth_pattern && (
            <ResultCard
              icon="📈"
              title="Growth Pattern"
              text="Based on imaging features, the detected region may belong to a faster-developing group. Your doctor will discuss this."
            />
          )}

          {vis?.treatment_considerations && (
            <ResultCard
              icon="💊"
              title="Treatment Considerations"
              text="Some treatments may be more or less effective based on imaging findings. Your doctor will outline the best options."
            />
          )}

          {vis?.surgical_assessment && (
            <ResultCard
              icon="🏥"
              title="Surgical Assessment"
              text="A significant portion of the affected area may be accessible for surgical intervention. Your team will evaluate this."
            />
          )}

          {vis?.next_steps && (
            <ResultCard
              icon="⏳"
              title="Next Steps"
              text="Your doctor will explain everything in your upcoming consultation. Please attend all scheduled appointments."
            />
          )}
        </div>
      )}

      {vis?.tumor_type && data && (
        <div className="card patient-clinical-card">
          <h3>🔬 Tumor Classification</h3>
          <p className="hint">
            The AI system identified the following tumor type:
          </p>

          <div className="patient-tumor-display">
            <span className="patient-tumor-name">
              {data.tumorType}
            </span>
            <span className="patient-tumor-conf">
              {data.probabilities[0].value}% AI confidence
            </span>
          </div>

          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 12,
            }}
          >
            Your doctor will confirm and explain this result.
          </p>
        </div>
      )}

      {vis?.survival_estimate && data && (
        <div className="card patient-clinical-card patient-sensitive-card">
          <h3>⏳ Prognosis Information</h3>
          <p className="hint">
            A statistical estimate based on imaging data. Individual
            outcomes vary widely.
          </p>

          <div className="patient-survival-display">
            {data.survival}
          </div>

          <p
            style={{
              fontSize: 13,
              color: "var(--warning)",
              marginTop: 12,
            }}
          >
            ⚠️ Please discuss this with your doctor before drawing any
            conclusions.
          </p>
        </div>
      )}

      {vis?.clinical_markers && data && (
        <div className="card patient-clinical-card">
          <h3>🧬 Biological Markers</h3>
          <p className="hint">
            Genetic and molecular markers from your scan analysis:
          </p>

          <div className="patient-markers-grid">
            <div className="patient-marker">
              <span>Grade</span>
              <strong>{data.grade}</strong>
            </div>
            <div className="patient-marker">
              <span>IDH Status</span>
              <strong>{data.idh}</strong>
            </div>
            <div className="patient-marker">
              <span>MGMT Promoter</span>
              <strong>{data.mgmt}</strong>
            </div>
          </div>
        </div>
      )}

      {vis?.xai_explanation && data && (
        <div className="card patient-clinical-card">
          <h3>🤖 How the AI Made Its Decision</h3>
          <p className="hint">
            Factors the AI considered when analyzing your scan:
          </p>

          {data.xaiFeatures.map((feature, index) => (
            <div key={index} className="xai-row">
              <span className="xai-label">{feature.name}</span>
              <div className="xai-bar-bg">
                <div
                  className="xai-bar-fill"
                  style={{ width: `${feature.importance}%` }}
                />
              </div>
              <span className="xai-pct">
                {feature.importance}%
              </span>
            </div>
          ))}
        </div>
      )}

      {visits.length > 0 && (
        <VisitTimeline visits={visits} readOnly />
      )}

      <div className="warning-banner">
        ⚠️ This report is not a diagnosis. Only your doctor can interpret
        these results and recommend treatment.
      </div>

      <div className={`chatbot-container ${chatOpen ? "open" : ""}`}>
        <button
          className="chatbot-toggle"
          onClick={() => setChatOpen((open) => !open)}
        >
          {chatOpen ? "✕ Close" : "💬 Ask a Question"}
        </button>

        {chatOpen && (
          <div className="chatbot-panel">
            <div className="chat-header">NeuroScan Assistant</div>

            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`chat-bubble ${message.role}`}
                >
                  {message.text}
                </div>
              ))}
            </div>

            <div className="chat-input-row">
              <input
                value={chatInput}
                onChange={(event) =>
                  setChatInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendMessage();
                }}
                placeholder="Ask about your results…"
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
