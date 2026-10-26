import { useState, useRef } from "react";
import { ALZ_SEQUENCES, ALZ_PIPELINE, ALZHEIMER_DATA, CONDITIONS, conditionOf } from "../data/conditions";
import {
  filterName, filterTc, filterAge, validateName, validateTc, validateAge,
  firstError, joinName,
} from "../utils/validators";
import { supabase } from "../supabaseClient";

// Sequences matched to UCSF-PDGM dataset file naming
const MRI_SEQUENCES = [
  { key: "T1",           label: "T1",           hint: "_T1.nii.gz"            },
  { key: "T1c",          label: "T1c",          hint: "_T1c.nii.gz"           },
  { key: "T2",           label: "T2",           hint: "_T2.nii.gz"            },
  { key: "FLAIR",        label: "FLAIR",        hint: "_FLAIR.nii.gz"         },
  { key: "DWI",          label: "DWI",          hint: "_DWI.nii.gz"           },
  { key: "ADC",          label: "ADC",          hint: "_ADC.nii.gz"           },
  { key: "SWI",          label: "SWI",          hint: "_SWI.nii.gz"           },
  { key: "ASL",          label: "ASL",          hint: "_ASL.nii.gz"           },
  { key: "DTI_FA",       label: "DTI FA",       hint: "_DTI_eddy_FA.nii.gz"   },
  { key: "DTI_MD",       label: "DTI MD",       hint: "_DTI_eddy_MD.nii.gz"   },
  { key: "DTI_L1",       label: "DTI L1",       hint: "_DTI_eddy_L1.nii.gz"   },
  { key: "DTI_L2",       label: "DTI L2",       hint: "_DTI_eddy_L2.nii.gz"   },
  { key: "DTI_L3",       label: "DTI L3",       hint: "_DTI_eddy_L3.nii.gz"   },
  { key: "SEG",          label: "Tumor Seg",    hint: "_tumor_segmentation.nii.gz" },
];

export default function AddNewCase({ nav, session, onCaseAdded, toast, followUpCase = null }) {
  const isFollowUp = !!followUpCase;   // true → add a new visit to an existing case
  const [step, setStep]               = useState(1);
  const [patientInfo, setPatientInfo] = useState({
    firstName: "",
    lastName:  "",
    tc:        "",                                  // new cases only — never stored in the browser state of follow-ups
    age:      followUpCase?.age != null ? String(followUpCase.age) : "",
    sex:      followUpCase?.sex ?? "Male",
    scanDate: "",
    notes:    "",
  });
  const [files, setFiles]             = useState({});
  const [fileProgress, setFileProgress] = useState({});
  const [processingSteps, setProcessingSteps] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [done, setDone]               = useState(false);
  const [saving, setSaving]           = useState(false);
  const [savedNoMri, setSavedNoMri]     = useState(false);   // follow-up visit saved without any scans
  const [error, setError]             = useState("");
  // Condition: new cases choose it; a follow-up visit always uses its case's condition.
  const [newCondition, setNewCondition] = useState("tumor");
  const condition = isFollowUp ? conditionOf(followUpCase) : newCondition;
  const isAlz     = condition === "alzheimer";
  const sequences = isAlz ? ALZ_SEQUENCES : MRI_SEQUENCES;   // sequences required for this condition
  const changeCondition = (next) => {
    if (next === newCondition) return;
    setNewCondition(next);
    setFiles({}); setFileProgress({}); setError("");        // the required sequences differ per condition
  };

  const updateInfo = (k, v) => setPatientInfo(f => ({ ...f, [k]: v }));

  // Validates step 1. Returns an error message or null. Follow-up visits only need a date (patient data is locked).
  const validateStep1 = () => {
    if (isFollowUp) return patientInfo.scanDate ? null : "Please select the visit date.";
    return firstError(
      validateName(patientInfo.firstName, "Patient first name"),
      validateName(patientInfo.lastName, "Patient last name"),
      validateTc(patientInfo.tc),
      validateAge(patientInfo.age),
      patientInfo.scanDate ? null : "Please select the scan date.",
    );
  };

  const simulateProgress = (key) => {
    let prog = 0;
    const iv = setInterval(() => {
      prog += Math.random() * 25 + 10;
      if (prog >= 100) { prog = 100; clearInterval(iv); }
      setFileProgress(fp => ({ ...fp, [key]: Math.min(100, Math.round(prog)) }));
    }, 200);
  };

  const handleFileSelect = (seq, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFiles(f => ({ ...f, [seq]: file }));
    simulateProgress(seq);
  };

  // Filename matching rules — maps each sequence key to patterns in the filename
  const MATCH_RULES = [
    { key: "SEG",    patterns: ["tumor_segmentation", "seg"] },
    { key: "T1c",    patterns: ["_t1c", "_t1ce", "t1c."] },
    { key: "T1",     patterns: ["_t1."] },
    { key: "T2",     patterns: ["_t2."] },
    { key: "FLAIR",  patterns: ["flair"] },
    { key: "DWI",    patterns: ["dwi"] },
    { key: "ADC",    patterns: ["adc"] },
    { key: "SWI",    patterns: ["swi"] },
    { key: "ASL",    patterns: ["asl"] },
    { key: "DTI_FA", patterns: ["dti_eddy_fa", "dti_fa"] },
    { key: "DTI_MD", patterns: ["dti_eddy_md", "dti_md"] },
    { key: "DTI_L1", patterns: ["dti_eddy_l1", "dti_l1"] },
    { key: "DTI_L2", patterns: ["dti_eddy_l2", "dti_l2"] },
    { key: "DTI_L3", patterns: ["dti_eddy_l3", "dti_l3"] },
  ];

  const matchFileToSequence = (filename) => {
    const lower = filename.toLowerCase();
    for (const rule of MATCH_RULES) {
      if (rule.patterns.some(p => lower.includes(p))) return rule.key;
    }
    return null;
  };

  const handleFolderUpload = (e) => {
    const allFiles = Array.from(e.target.files);
    const niiFiles = allFiles.filter(f => f.name.endsWith(".nii") || f.name.endsWith(".nii.gz"));

    const matched   = {};
    const unmatched = [];

    const activeKeys = new Set(sequences.map(s => s.key));
    for (const file of niiFiles) {
      const key = matchFileToSequence(file.name);
      if (key && activeKeys.has(key)) matched[key] = file;
      else unmatched.push(file.name);
    }

    if (Object.keys(matched).length === 0) {
      setError("No matching NIfTI files found in the selected folder. Make sure the folder contains files like _T1.nii.gz, _FLAIR.nii.gz, etc.");
      return;
    }

    setFiles(f => ({ ...f, ...matched }));
    Object.keys(matched).forEach(key => simulateProgress(key));

    if (unmatched.length > 0) {
      setError(`${Object.keys(matched).length} files matched automatically. Could not match: ${unmatched.join(", ")}`);
    } else {
      setError("");
    }
  };

  const uploadedCount = Object.keys(files).length;
  const allUploaded   = uploadedCount === sequences.length;
  const seqKeys       = sequences.map(s => s.key);

  const TUMOR_PIPELINE = [
    { id: 1, label: "Preprocessing",      sub: "Preprocessing MRI Scans...",           range: [10, 30] },
    { id: 2, label: "Upload Complete",    sub: "Files received successfully",           range: [30, 30] },
    { id: 3, label: "Classification",     sub: "Running tumor classification model...", range: [30, 50] },
    { id: 4, label: "Segmentation",       sub: "Segmenting tumor region...",            range: [50, 70] },
    { id: 5, label: "Feature Extraction", sub: "Extracting tumor features...",          range: [70, 85] },
    { id: 6, label: "Explainable AI",     sub: "Generating visual explanation...",      range: [85, 95] },
    { id: 7, label: "Report Generation",  sub: "Saving results...",                     range: [95, 100] },
  ];
  const PIPELINE = isAlz ? ALZ_PIPELINE : TUMOR_PIPELINE;

  const startAnalysis = async () => {
    const infoError = validateStep1();
    if (infoError) { setError(infoError); return; }

    // MRI is compulsory only for the first visit (new case). A follow-up visit can be saved without any scans:
    // it only records the date and notes, and no new analysis is run.
    if (isFollowUp && uploadedCount === 0) {
      setError(""); setSaving(true);
      const { error: visitErr } = await supabase.from("visits").insert({
        case_id: followUpCase.id,
        visit_date: patientInfo.scanDate,
        notes: patientInfo.notes.trim() || null,
        status: "Done",
      });
      if (visitErr) { setError("Failed to save visit: " + visitErr.message); setSaving(false); return; }
      setSaving(false);
      setSavedNoMri(true); setStep(3); window.scrollTo(0, 0);
      onCaseAdded();
      toast.success("Visit saved", "The visit was saved without MRI scans, so no new analysis was run.");
      return;
    }

    if (!allUploaded) {
      const missing = sequences
        .filter(s => !files[s.key])
        .map(s => s.label);
      setError(`Missing ${missing.length} sequence${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. ${isFollowUp
        ? "Upload all sequences to run a new analysis, or clear the uploads to save this visit without MRI."
        : "Please upload these before starting analysis."}`);
      return;
    }

    setError(""); setSaving(true);
    const caseId = isFollowUp ? followUpCase.id : `C${Date.now().toString().slice(-6)}`;

    if (isFollowUp) {
      // Existing case: only bump status (and last scan date if this visit is the newest)
      const newest = patientInfo.scanDate > (followUpCase.scan_date ?? "");
      const { error: upErr } = await supabase.from("cases")
        .update({ status: "Processing", ...(newest ? { scan_date: patientInfo.scanDate } : {}) })
        .eq("id", caseId);
      if (upErr) { setError("Failed to update case: " + upErr.message); setSaving(false); return; }
    } else {
      const { error: caseErr } = await supabase.from("cases").insert({
        id: caseId,
        patient_name: joinName(patientInfo.firstName, patientInfo.lastName),
        age: parseInt(patientInfo.age, 10),
        sex: patientInfo.sex,
        scan_date: patientInfo.scanDate,
        status: "Processing",
        doctor_id: session.user.id,
        patient_id: null,
        ...(isAlz ? { condition: "alzheimer" } : {}),
      });
      if (caseErr) {
        setError(/condition/i.test(caseErr.message)
          ? "The database is not ready for Alzheimer's cases yet. Run supabase_setup.sql in Supabase first."
          : "Failed to save case: " + caseErr.message);
        setSaving(false); return;
      }

      // Store the patient's T.C. Kimlik No (hashed/protected server-side) so the patient can later link this case
      // with Case ID + T.C. If this fails, roll back the half-created case.
      const { error: tcErr } = await supabase.rpc("set_case_patient_tc", { p_case_id: caseId, p_tc: patientInfo.tc.trim() });
      if (tcErr) {
        await supabase.from("cases").delete().eq("id", caseId);
        setError(tcErr.message?.includes("invalid_tc")
          ? "Please enter a valid T.C. Kimlik No."
          : tcErr.message?.includes("does not exist")
            ? "Database functions are not installed (set_case_patient_tc). Run the SQL setup first."
            : "Failed to save the patient's T.C. Kimlik No: " + tcErr.message);
        setSaving(false); return;
      }
    }

    // Every scan session (including the first) is stored as a visit
    const { data: visit, error: visitErr } = await supabase.from("visits").insert({
      case_id: caseId,
      visit_date: patientInfo.scanDate,
      notes: patientInfo.notes.trim() || null,
      status: "Processing",
    }).select().single();
    if (visitErr) { setError("Failed to save visit: " + visitErr.message); setSaving(false); return; }
    const visitId = visit.id;

    // Upload real files to Supabase Storage
    const uploadRecords = [];
    for (const s of sequences) {
      const file = files[s.key];
      if (!file) continue;
      const path = `${session.user.id}/${caseId}/${visitId}/${s.key}_${file.name}`;
      const { data: storageData, error: storageErr } = await supabase.storage
        .from("mri-scans")
        .upload(path, file, { upsert: true });
      const fileUrl = storageErr ? null : storageData?.path;
      uploadRecords.push({
        case_id: caseId,
        visit_id: visitId,
        sequence_name: s.key,
        file_name: file.name,
        file_url: fileUrl,
      });
    }
    await supabase.from("mri_uploads").insert(uploadRecords);
    if (!isFollowUp) await supabase.from("patient_visibility").insert({ case_id: caseId, doctor_id: session.user.id });

    setSaving(false);
    setStep(3); setProcessingSteps([]); setOverallProgress(0); setDone(false);

    let stepIdx = 0, prog = 0;
    const run = async () => {
      if (stepIdx >= PIPELINE.length) {
        const risk = isAlz ? ALZHEIMER_DATA.risk : "Moderate";
        await supabase.from("cases").update({ status: "Done", risk }).eq("id", caseId);
        await supabase.from("visits").update({ status: "Done", risk }).eq("id", visitId);
        if (isAlz) {
          // Placeholder values until the Alzheimer's model is connected (same as the tumor sample below).
          await supabase.from("analysis_results").insert({
            case_id: caseId, visit_id: visitId, tumor_type: ALZHEIMER_DATA.diagnosis, grade: ALZHEIMER_DATA.stage,
            idh_status: "N/A", mgmt_status: "N/A", survival_estimate: "N/A",
            prob_glioblastoma: 0, prob_astrocytoma: 0, prob_oligodendroglioma: 0,
          });
          await supabase.from("xai_features").insert(
            ALZHEIMER_DATA.xaiFeatures.map(f => ({ case_id: caseId, visit_id: visitId, feature_name: f.name, importance_score: f.importance }))
          );
        } else {
          await supabase.from("analysis_results").insert({
            case_id: caseId, visit_id: visitId, tumor_type: "Glioblastoma", grade: "High-grade (IV)",
            idh_status: "Wild-type", mgmt_status: "Unmethylated",
            survival_estimate: "Estimated: 10–16 months",
            prob_glioblastoma: 78, prob_astrocytoma: 15, prob_oligodendroglioma: 7,
          });
          await supabase.from("xai_features").insert([
            { case_id: caseId, visit_id: visitId, feature_name: "Tumor Volume", importance_score: 92 },
            { case_id: caseId, visit_id: visitId, feature_name: "Age",          importance_score: 78 },
            { case_id: caseId, visit_id: visitId, feature_name: "ADC Entropy",  importance_score: 65 },
            { case_id: caseId, visit_id: visitId, feature_name: "rCBV Mean",    importance_score: 54 },
            { case_id: caseId, visit_id: visitId, feature_name: "FLAIR Ratio",  importance_score: 41 },
          ]);
        }
        setDone(true); onCaseAdded(); toast.success('Analysis complete!', 'The case has been saved and results are ready to review.'); return;
      }
      const s = PIPELINE[stepIdx];
      setProcessingSteps(prev => [...prev, { ...s, status: "running" }]);
      const target = s.range[1];
      const tick = setInterval(() => {
        prog += Math.random() * 5 + 2;
        if (prog >= target) {
          prog = target; clearInterval(tick);
          setOverallProgress(target);
          setProcessingSteps(prev => prev.map(x => x.id === s.id ? { ...x, status: "done" } : x));
          stepIdx++; setTimeout(run, 400);
        } else setOverallProgress(Math.round(prog));
      }, 150);
    };
    setTimeout(run, 500);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{isFollowUp ? "Add Follow-up Visit" : "Add New Case"}</h2>
          <p className="subtitle">
            {isFollowUp
              ? `New MRI session for ${followUpCase.patient_name} · Case ${followUpCase.id}`
              : "Upload MRI sequences and submit for AI analysis"}
          </p>
        </div>
        <button className="btn-ghost" onClick={() => nav(isFollowUp ? "doctorDashboard" : "doctorSelect")}>⬅ Back</button>
      </div>

      <div className="steps-indicator">
        {[isFollowUp ? "Visit Info" : "Patient Info","Upload MRI","Processing"].map((s, i) => (
          <div key={i} className={`step ${step > i+1 ? "done" : step === i+1 ? "active" : ""}`}>
            <div className="step-num">{step > i+1 ? "✓" : i+1}</div><span>{s}</span>
          </div>
        ))}
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {step === 1 && (
        <div className="card">
          <h3>{isFollowUp ? "Visit Information" : "Patient Information"}</h3>

          {isFollowUp ? (
            <p className="hint" style={{ marginBottom: 16 }}>
              Condition: <span className={`badge ${CONDITIONS[condition].badge}`}>{CONDITIONS[condition].icon} {CONDITIONS[condition].label}</span>
            </p>
          ) : (
            <div className="form-group">
              <label>Condition to Analyze</label>
              <div className="role-toggle">
                {Object.values(CONDITIONS).map(c => (
                  <button key={c.key} type="button" className={condition === c.key ? "active" : ""} onClick={() => changeCondition(c.key)}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}



          <div className="form-grid">
            {isFollowUp ? (
              <div className="form-group">
                <label>Patient</label>
                <input type="text" disabled value={followUpCase.patient_name ?? ""} />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Patient First Name</label>
                  <input type="text" placeholder="Ayşe" value={patientInfo.firstName}
                    onChange={e => updateInfo("firstName", filterName(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Patient Last Name</label>
                  <input type="text" placeholder="Çelik" value={patientInfo.lastName}
                    onChange={e => updateInfo("lastName", filterName(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>T.C. Kimlik No</label>
                  <input type="text" inputMode="numeric" autoComplete="off" placeholder="11-digit T.C. Kimlik No"
                    value={patientInfo.tc} onChange={e => updateInfo("tc", filterTc(e.target.value))} />
                </div>
              </>
            )}
            <div className="form-group">
              <label>Age</label>
              <input type="text" inputMode="numeric" placeholder="45" disabled={isFollowUp} value={patientInfo.age}
                onChange={e => updateInfo("age", filterAge(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Sex</label>
              <select disabled={isFollowUp} value={patientInfo.sex} onChange={e => updateInfo("sex", e.target.value)}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>{isFollowUp ? "Visit Date" : "Scan Date"}</label>
              <input type="date" value={patientInfo.scanDate} onChange={e => updateInfo("scanDate", e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Visit Notes <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
            <textarea className="doctor-note-input" rows={3}
              placeholder="e.g. 3-month post-surgery follow-up, patient reports mild headaches."
              value={patientInfo.notes} onChange={e => updateInfo("notes", e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => {
            const infoError = validateStep1();
            if (infoError) { setError(infoError); return; }
            setError(""); setStep(2); window.scrollTo(0,0);
          }}>Continue to MRI Upload →</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>Upload {sequences.length} × 3D MRI Sequence{sequences.length > 1 ? "s" : ""} <span className="badge badge-blue">NIfTI Format</span></h3>
          <p className="hint">Accepted formats: <code>.nii</code>, <code>.nii.gz</code></p>
          {isAlz && (
            <p className="hint">Alzheimer's analysis uses structural MRI: a 3D T1-weighted scan (MPRAGE) and a FLAIR scan.</p>
          )}
          {isFollowUp && (
            <div style={{
              background: "var(--accent-dim)", border: "1px solid var(--accent-mid)", borderRadius: "var(--radius)",
              padding: "10px 14px", fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5,
            }}>
              <strong>MRI is optional for follow-up visits.</strong> Skip it to save only the visit date and notes,
              or upload all sequences to run a new analysis.
            </div>
          )}

          {/* Folder upload zone */}
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            border: "2px dashed var(--accent-mid)", borderRadius: "var(--radius-lg)",
            padding: "28px 20px", marginBottom: 20, cursor: "pointer",
            background: uploadedCount > 0 ? "var(--accent-dim)" : "var(--bg-alt)",
            transition: "all 0.2s",
          }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const items = e.dataTransfer.items;
            // Handle dropped files
            const droppedFiles = Array.from(e.dataTransfer.files);
            if (droppedFiles.length > 0) {
              const fakeEvent = { target: { files: droppedFiles } };
              handleFolderUpload(fakeEvent);
            }
          }}>
            <input
              type="file"
              webkitdirectory="true"
              multiple
              accept=".nii,.nii.gz"
              hidden
              onChange={handleFolderUpload}
            />
            <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 4 }}>
              {uploadedCount > 0 ? `${uploadedCount} / ${sequences.length} files matched` : "Upload Patient Folder"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 12 }}>
              Click to select the entire patient folder — files will be matched automatically by filename
            </div>
            {uploadedCount > 0 && uploadedCount < sequences.length && (
              <div style={{ fontSize: 12, color: "var(--warning)", fontWeight: 600 }}>
                ⚠ {sequences.length - uploadedCount} files not yet matched — use individual slots below
              </div>
            )}
            {uploadedCount === sequences.length && (
              <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 700 }}>
                ✓ All {sequences.length} sequences matched and ready
              </div>
            )}
            {uploadedCount === 0 && (
              <span style={{
                padding: "8px 20px", background: "var(--accent)", color: "#fff",
                borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600
              }}>Select Folder</span>
            )}
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>or upload individual files below</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <div className="upload-count-badge">
            <strong>{uploadedCount} / {sequences.length}</strong> sequences uploaded
            {uploadedCount === sequences.length && <span style={{ color: "var(--success)", marginLeft: 10, fontWeight: 700 }}>✓ All ready</span>}
          </div>
          <div className="mri-upload-grid">
            {sequences.map(s => (
              <div key={s.key} className={`mri-seq-card ${files[s.key] ? "uploaded" : ""} ${s.key === "SEG" ? "seg-card" : ""}`}>
                <div className="seq-label">{s.label}</div>
                <div className="seq-hint">{s.hint}</div>
                {files[s.key] ? (
                  <>
                    <div className="seq-filename">{files[s.key].name}</div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${fileProgress[s.key]||0}%` }} /></div>
                    <span className="seq-status">{(fileProgress[s.key]||0) < 100 ? `${fileProgress[s.key]}%` : "✓ Done"}</span>
                  </>
                ) : (
                  <label className={`upload-btn-sm ${s.key === "SEG" ? "upload-btn-seg" : ""}`}>
                    + Upload
                    <input type="file" accept=".nii,.nii.gz" hidden onChange={e => handleFileSelect(s.key, e)} />
                  </label>
                )}
              </div>
            ))}
          </div>
          {isFollowUp && uploadedCount > 0 && !allUploaded && (
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--warning, #b7791f)" }}>
              ⚠ {sequences.length - uploadedCount} sequences still missing. Upload them all to run the analysis, or{" "}
              <span style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
                onClick={() => { setFiles({}); setFileProgress({}); }}>clear the uploads</span> to save the visit without MRI.
            </div>
          )}
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
            {(() => {
              const skipMri  = isFollowUp && uploadedCount === 0;
              const canSubmit = !saving && (skipMri || allUploaded);
              return (
                <button className="btn-primary" onClick={startAnalysis} disabled={!canSubmit} style={{ opacity: canSubmit ? 1 : 0.5 }}>
                  {saving ? (skipMri ? "Saving visit…" : "⬆ Uploading files to server…") : skipMri ? "💾 Save Visit without MRI" : "🔬 Start Analysis"}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {step === 3 && savedNoMri && (
        <div className="card processing-card">
          <h3>✅ Visit Saved</h3>
          <p className="hint">This follow-up visit was saved without MRI scans, so no new analysis was run.
            You can add the scans to a later visit at any time.</p>
          <div style={{ marginTop: 24 }}>
            <button className="btn-primary" style={{ marginRight: 10 }} onClick={() => nav("doctorDashboard")}>📅 Back to Case</button>
            <button className="btn-ghost" onClick={() => nav("doctorSelect")}>📋 Go to Case List</button>
          </div>
        </div>
      )}

      {step === 3 && !savedNoMri && (
        <div className="card processing-card">
          <h3>{done ? "✅ Analysis Complete" : "🔬 Analyzing MRI Scans…"}</h3>
          {!done && <p className="hint">Do not close this page while processing.</p>}
          <div className="overall-progress">
            <div className="overall-bar"><div className="overall-fill" style={{ width: `${overallProgress}%` }} /></div>
            <span className="overall-pct">{overallProgress}%</span>
          </div>
          <div className="pipeline-steps">
            {PIPELINE.map(s => {
              const found = processingSteps.find(x => x.id === s.id);
              const status = found ? found.status : "pending";
              return (
                <div key={s.id} className={`pipeline-step ${status}`}>
                  <div className="pipeline-dot">{status === "done" ? "✓" : status === "running" ? "…" : ""}</div>
                  <div>
                    <div className="pipeline-label">{s.label}</div>
                    <div className="pipeline-sub">{s.sub} <em>({s.range[0]}–{s.range[1]}%)</em></div>
                  </div>
                </div>
              );
            })}
          </div>
          {done && <div style={{ marginTop: 24 }}>{isFollowUp && <button className="btn-primary" style={{ marginRight: 10 }} onClick={() => nav("doctorDashboard")}>📅 Back to Case</button>}
            <button className={isFollowUp ? "btn-ghost" : "btn-primary"} onClick={() => nav("doctorSelect")}>📋 Go to Case List</button></div>}
        </div>
      )}
    </div>
  );
}

