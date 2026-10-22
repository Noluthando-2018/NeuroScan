import { useState } from "react";
import { supabase } from "../supabaseClient";
import { tcFormat, validateTc, generateCaseId } from "../utils/validators";

// Sequences matched to UCSF-PDGM dataset file naming
const MRI_SEQUENCES = [
  { key: "T1", label: "T1", hint: "_T1.nii.gz" },
  { key: "T1c", label: "T1c", hint: "_T1c.nii.gz" },
  { key: "T2", label: "T2", hint: "_T2.nii.gz" },
  { key: "FLAIR", label: "FLAIR", hint: "_FLAIR.nii.gz" },
  { key: "DWI", label: "DWI", hint: "_DWI.nii.gz" },
  { key: "ADC", label: "ADC", hint: "_ADC.nii.gz" },
  { key: "SWI", label: "SWI", hint: "_SWI.nii.gz" },
  { key: "ASL", label: "ASL", hint: "_ASL.nii.gz" },
  { key: "DTI_FA", label: "DTI FA", hint: "_DTI_eddy_FA.nii.gz" },
  { key: "DTI_MD", label: "DTI MD", hint: "_DTI_eddy_MD.nii.gz" },
  { key: "DTI_L1", label: "DTI L1", hint: "_DTI_eddy_L1.nii.gz" },
  { key: "DTI_L2", label: "DTI L2", hint: "_DTI_eddy_L2.nii.gz" },
  { key: "DTI_L3", label: "DTI L3", hint: "_DTI_eddy_L3.nii.gz" },
  {
    key: "SEG",
    label: "Tumor Seg",
    hint: "_tumor_segmentation.nii.gz",
  },
];

const MATCH_RULES = [
  { key: "SEG", patterns: ["tumor_segmentation", "seg"] },
  { key: "T1c", patterns: ["_t1c", "_t1ce", "t1c."] },
  { key: "T1", patterns: ["_t1."] },
  { key: "T2", patterns: ["_t2."] },
  { key: "FLAIR", patterns: ["flair"] },
  { key: "DWI", patterns: ["dwi"] },
  { key: "ADC", patterns: ["adc"] },
  { key: "SWI", patterns: ["swi"] },
  { key: "ASL", patterns: ["asl"] },
  { key: "DTI_FA", patterns: ["dti_eddy_fa", "dti_fa"] },
  { key: "DTI_MD", patterns: ["dti_eddy_md", "dti_md"] },
  { key: "DTI_L1", patterns: ["dti_eddy_l1", "dti_l1"] },
  { key: "DTI_L2", patterns: ["dti_eddy_l2", "dti_l2"] },
  { key: "DTI_L3", patterns: ["dti_eddy_l3", "dti_l3"] },
];

const PIPELINE = [
  {
    id: 1,
    label: "Preprocessing",
    sub: "Preprocessing MRI Scans...",
    range: [10, 30],
  },
  {
    id: 2,
    label: "Upload Complete",
    sub: "Files received successfully",
    range: [30, 30],
  },
  {
    id: 3,
    label: "Classification",
    sub: "Running tumor classification model...",
    range: [30, 50],
  },
  {
    id: 4,
    label: "Segmentation",
    sub: "Segmenting tumor region...",
    range: [50, 70],
  },
  {
    id: 5,
    label: "Feature Extraction",
    sub: "Extracting tumor features...",
    range: [70, 85],
  },
  {
    id: 6,
    label: "Explainable AI",
    sub: "Generating visual explanation...",
    range: [85, 95],
  },
  {
    id: 7,
    label: "Report Generation",
    sub: "Saving results...",
    range: [95, 100],
  },
];

export default function AddNewCase({
  nav,
  session,
  onCaseAdded,
  toast,
  followUpCase = null,
}) {
  const isFollowUp = !!followUpCase;

  const [step, setStep] = useState(1);

  const [patientInfo, setPatientInfo] = useState({
    name: followUpCase?.patient_name ?? "",
    age:
      followUpCase?.age != null ? String(followUpCase.age) : "",
    sex: followUpCase?.sex ?? "Male",
    scanDate: "",
    notes: "",
    tc: "",
  });

  const [files, setFiles] = useState({});
  const [fileProgress, setFileProgress] = useState({});
  const [processingSteps, setProcessingSteps] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateInfo = (key, value) => {
    setPatientInfo((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const simulateProgress = (key) => {
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10;

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }

      setFileProgress((current) => ({
        ...current,
        [key]: Math.min(100, Math.round(progress)),
      }));
    }, 200);
  };

  const handleFileSelect = (sequence, event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setFiles((current) => ({
      ...current,
      [sequence]: file,
    }));

    simulateProgress(sequence);
    event.target.value = "";
  };

  const matchFileToSequence = (filename) => {
    const lower = filename.toLowerCase();

    for (const rule of MATCH_RULES) {
      if (rule.patterns.some((pattern) => lower.includes(pattern))) {
        return rule.key;
      }
    }

    return null;
  };

  const handleFolderUpload = (event) => {
    const allFiles = Array.from(event.target.files ?? []);

    const niiFiles = allFiles.filter((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith(".nii") || name.endsWith(".nii.gz");
    });

    const matched = {};
    const unmatched = [];

    for (const file of niiFiles) {
      const key = matchFileToSequence(file.name);

      if (key) {
        matched[key] = file;
      } else {
        unmatched.push(file.name);
      }
    }

    if (Object.keys(matched).length === 0) {
      setError(
        "No matching NIfTI files found. Make sure the folder contains files like _T1.nii.gz, _FLAIR.nii.gz, etc."
      );
      event.target.value = "";
      return;
    }

    setFiles((current) => ({
      ...current,
      ...matched,
    }));

    Object.keys(matched).forEach(simulateProgress);

    if (unmatched.length > 0) {
      setError(
        `${Object.keys(matched).length} files matched automatically. Could not match: ${unmatched.join(", ")}`
      );
    } else {
      setError("");
    }

    event.target.value = "";
  };

  const uploadedCount = Object.keys(files).length;
  const allUploaded = uploadedCount === MRI_SEQUENCES.length;

  const validatePatientInfo = () => {
    if (
      !patientInfo.name.trim() ||
      !patientInfo.age ||
      !patientInfo.scanDate
    ) {
      return "Please fill in all patient details.";
    }

    const age = Number(patientInfo.age);

    if (!Number.isInteger(age) || age < 1 || age > 120) {
      return "Please enter a valid patient age.";
    }

    if (!isFollowUp) {
      return validateTc(patientInfo.tc);
    }

    return null;
  };

  const startAnalysis = async () => {
    const validationError = validatePatientInfo();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!allUploaded) {
      const missing = MRI_SEQUENCES
        .filter((sequence) => !files[sequence.key])
        .map((sequence) => sequence.label);

      setError(
        `Missing ${missing.length} sequence${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Please upload these before starting analysis.`
      );
      return;
    }

    if (!session?.user?.id) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setError("");
    setSaving(true);

    // Random, unguessable Case ID (patients need it, together with their T.C. No, to link the case)
    let caseId = isFollowUp ? followUpCase.id : generateCaseId();

    let visitId = null;
    let newCaseCreated = false;
    const uploadedPaths = [];   // storage files of THIS attempt (removed again if the attempt fails)

    // Undo a half-finished attempt so no orphan rows / stuck "Processing" cases are left behind.
    const rollback = async () => {
      try {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("mri-scans").remove(uploadedPaths);
        }

        if (isFollowUp) {
          if (visitId) {
            await supabase.from("mri_uploads").delete().eq("visit_id", visitId);
            await supabase.from("visits").delete().eq("id", visitId);
          }
          // give the case back its previous status and scan date
          await supabase
            .from("cases")
            .update({ status: followUpCase.status, scan_date: followUpCase.scan_date })
            .eq("id", caseId);
        } else if (newCaseCreated) {
          await supabase.from("mri_uploads").delete().eq("case_id", caseId);
          await supabase.from("patient_visibility").delete().eq("case_id", caseId);
          await supabase.from("visits").delete().eq("case_id", caseId);
          await supabase.from("cases").delete().eq("id", caseId);
        }
      } catch (cleanupError) {
        console.error("Cleanup after a failed attempt did not finish:", cleanupError);
      }
    };

    try {
      if (isFollowUp) {
        // Update the existing case for this new visit.
        const newest =
          patientInfo.scanDate > (followUpCase.scan_date ?? "");

        const { error: updateError } = await supabase
          .from("cases")
          .update({
            status: "Processing",
            ...(newest ? { scan_date: patientInfo.scanDate } : {}),
          })
          .eq("id", caseId);

        if (updateError) {
          throw new Error(
            "Failed to update case: " + updateError.message
          );
        }
      } else {
        // Create the case first (a new random ID is drawn in the very unlikely case of a collision).
        let created = false;

        for (let attempt = 0; attempt < 3 && !created; attempt++) {
          const { error: caseError } = await supabase
            .from("cases")
            .insert({
              id: caseId,
              patient_name: patientInfo.name.trim(),
              age: Number.parseInt(patientInfo.age, 10),
              sex: patientInfo.sex,
              scan_date: patientInfo.scanDate,
              status: "Processing",
              doctor_id: session.user.id,
              patient_id: null,
            });

          if (!caseError) {
            created = true;
          } else if (caseError.code === "23505") {
            caseId = generateCaseId();
          } else {
            throw new Error("Failed to save case: " + caseError.message);
          }
        }

        if (!created) {
          throw new Error("Could not generate a unique Case ID. Please try again.");
        }

        newCaseCreated = true;

        // Save the patient's TC using the same RPC as the mobile app.
        const { error: tcError } = await supabase.rpc(
          "set_case_patient_tc",
          {
            p_case_id: caseId,
            p_tc: patientInfo.tc.trim(),
          }
        );

        if (tcError) {
          console.error("Failed to save patient TC:", tcError);

          // Roll back the new case if its TC cannot be saved.
          const { error: rollbackError } = await supabase
            .from("cases")
            .delete()
            .eq("id", caseId);

          if (rollbackError) {
            console.error("Case rollback failed:", rollbackError);
          }

          newCaseCreated = false;

          throw new Error(
            "Failed to save the patient's identification details. Please check your connection and try again."
          );
        }
      }

      // Store every scan session as a visit.
      const { data: visit, error: visitError } = await supabase
        .from("visits")
        .insert({
          case_id: caseId,
          visit_date: patientInfo.scanDate,
          notes: patientInfo.notes.trim() || null,
          status: "Processing",
        })
        .select()
        .single();

      if (visitError) {
        throw new Error(
          "Failed to save visit: " + visitError.message
        );
      }

      visitId = visit.id;

      // Upload MRI files to Supabase Storage.
      const uploadRecords = [];

      for (const sequence of MRI_SEQUENCES) {
        const file = files[sequence.key];

        if (!file) continue;

        const path = `${session.user.id}/${caseId}/${visitId}/${sequence.key}_${file.name}`;

        const { data: storageData, error: storageError } =
          await supabase.storage
            .from("mri-scans")
            .upload(path, file, { upsert: true });

        if (storageError) {
          throw new Error(
            `Failed to upload ${file.name}: ${storageError.message}`
          );
        }

        uploadedPaths.push(storageData?.path ?? path);

        uploadRecords.push({
          case_id: caseId,
          visit_id: visitId,
          sequence_name: sequence.key,
          file_name: file.name,
          file_url: storageData?.path ?? path,
        });
      }

      if (uploadRecords.length > 0) {
        const { error: recordsError } = await supabase
          .from("mri_uploads")
          .insert(uploadRecords);

        if (recordsError) {
          throw new Error(
            "Failed to save MRI upload records: " +
              recordsError.message
          );
        }
      }

      // Create the visibility row for a new case.
      if (!isFollowUp) {
        const { error: visibilityError } = await supabase
          .from("patient_visibility")
          .insert({
            case_id: caseId,
            doctor_id: session.user.id,
          });

        if (visibilityError) {
          throw new Error(
            "Failed to initialize patient visibility settings: " +
              visibilityError.message
          );
        }
      }

      setSaving(false);
      setStep(3);
      setProcessingSteps([]);
      setOverallProgress(0);
      setDone(false);

      let stepIndex = 0;
      let progress = 0;

      const runPipeline = async () => {
        if (stepIndex >= PIPELINE.length) {
          try {
            const { error: caseUpdateError } = await supabase
              .from("cases")
              .update({ status: "Done", risk: "Moderate" })
              .eq("id", caseId);

            if (caseUpdateError) throw caseUpdateError;

            const { error: visitUpdateError } = await supabase
              .from("visits")
              .update({ status: "Done", risk: "Moderate" })
              .eq("id", visitId);

            if (visitUpdateError) throw visitUpdateError;

            const { error: resultsError } = await supabase
              .from("analysis_results")
              .insert({
                case_id: caseId,
                visit_id: visitId,
                tumor_type: "Glioblastoma",
                grade: "High-grade (IV)",
                idh_status: "Wild-type",
                mgmt_status: "Unmethylated",
                survival_estimate: "Estimated: 10–16 months",
                prob_glioblastoma: 78,
                prob_astrocytoma: 15,
                prob_oligodendroglioma: 7,
              });

            if (resultsError) throw resultsError;

            const { error: featuresError } = await supabase
              .from("xai_features")
              .insert([
                {
                  case_id: caseId,
                  visit_id: visitId,
                  feature_name: "Tumor Volume",
                  importance_score: 92,
                },
                {
                  case_id: caseId,
                  visit_id: visitId,
                  feature_name: "Age",
                  importance_score: 78,
                },
                {
                  case_id: caseId,
                  visit_id: visitId,
                  feature_name: "ADC Entropy",
                  importance_score: 65,
                },
                {
                  case_id: caseId,
                  visit_id: visitId,
                  feature_name: "rCBV Mean",
                  importance_score: 54,
                },
                {
                  case_id: caseId,
                  visit_id: visitId,
                  feature_name: "FLAIR Ratio",
                  importance_score: 41,
                },
              ]);

            if (featuresError) throw featuresError;

            setDone(true);

            if (onCaseAdded) {
              await onCaseAdded();
            }

            toast.success(
              "Analysis complete!",
              "The case has been saved and results are ready to review."
            );
          } catch (pipelineError) {
            console.error("Analysis pipeline error:", pipelineError);
            setError(
              "The processing simulation finished, but saving the results failed. Please check the database and try again."
            );
            setDone(false);
          }

          return;
        }

        const currentStep = PIPELINE[stepIndex];

        setProcessingSteps((current) => [
          ...current,
          { ...currentStep, status: "running" },
        ]);

        const target = currentStep.range[1];

        const tick = setInterval(() => {
          progress += Math.random() * 5 + 2;

          if (progress >= target) {
            progress = target;
            clearInterval(tick);

            setOverallProgress(target);

            setProcessingSteps((current) =>
              current.map((item) =>
                item.id === currentStep.id
                  ? { ...item, status: "done" }
                  : item
              )
            );

            stepIndex += 1;
            setTimeout(runPipeline, 400);
          } else {
            setOverallProgress(Math.round(progress));
          }
        }, 150);
      };

      setTimeout(runPipeline, 500);
    } catch (err) {
      console.error("Create case / analysis error:", err);

      await rollback();   // remove whatever this attempt already saved, so the doctor can simply retry
      setError(err.message || "Something went wrong. Please try again.");
      setSaving(false);
    }
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

        <button
          className="btn-ghost"
          onClick={() =>
            nav(isFollowUp ? "doctorDashboard" : "doctorSelect")
          }
        >
          ⬅ Back
        </button>
      </div>

      <div className="steps-indicator">
        {[
          isFollowUp ? "Visit Info" : "Patient Info",
          "Upload MRI",
          "Processing",
        ].map((label, index) => (
          <div
            key={label}
            className={`step ${
              step > index + 1
                ? "done"
                : step === index + 1
                  ? "active"
                  : ""
            }`}
          >
            <div className="step-num">
              {step > index + 1 ? "✓" : index + 1}
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3>{isFollowUp ? "Visit Information" : "Patient Information"}</h3>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="patientName">Full Name</label>
              <input
                id="patientName"
                type="text"
                placeholder="John Doe"
                disabled={isFollowUp}
                value={patientInfo.name}
                onChange={(event) =>
                  updateInfo("name", event.target.value)
                }
              />
            </div>

            {!isFollowUp && (
              <div className="form-group">
                <label htmlFor="patientTc">T.C. Kimlik No</label>
                <input
                  id="patientTc"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={11}
                  placeholder="11-digit T.C. Kimlik No"
                  value={patientInfo.tc}
                  onChange={(event) => {
                    updateInfo("tc", tcFormat(event.target.value));
                    setError("");
                  }}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="patientAge">Age</label>
              <input
                id="patientAge"
                type="number"
                min="1"
                max="120"
                placeholder="45"
                disabled={isFollowUp}
                value={patientInfo.age}
                onChange={(event) =>
                  updateInfo("age", event.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="patientSex">Sex</label>
              <select
                id="patientSex"
                disabled={isFollowUp}
                value={patientInfo.sex}
                onChange={(event) =>
                  updateInfo("sex", event.target.value)
                }
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="scanDate">
                {isFollowUp ? "Visit Date" : "Scan Date"}
              </label>
              <input
                id="scanDate"
                type="date"
                value={patientInfo.scanDate}
                onChange={(event) =>
                  updateInfo("scanDate", event.target.value)
                }
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label htmlFor="visitNotes">
              Visit Notes{" "}
              <span
                style={{
                  color: "var(--text-muted)",
                  fontWeight: 400,
                }}
              >
                (optional)
              </span>
            </label>

            <textarea
              id="visitNotes"
              className="doctor-note-input"
              rows={3}
              placeholder="e.g. 3-month post-surgery follow-up, patient reports mild headaches."
              value={patientInfo.notes}
              onChange={(event) =>
                updateInfo("notes", event.target.value)
              }
            />
          </div>

          <button
            className="btn-primary"
            onClick={() => {
              const validationError = validatePatientInfo();

              if (validationError) {
                setError(validationError);
                return;
              }

              setError("");
              setStep(2);
              window.scrollTo(0, 0);
            }}
          >
            Continue to MRI Upload →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>
            Upload 14 × 3D MRI Sequences{" "}
            <span className="badge badge-blue">NIfTI Format</span>
          </h3>

          <p className="hint">
            Accepted formats: <code>.nii</code>, <code>.nii.gz</code>
          </p>

          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "2px dashed var(--accent-mid)",
              borderRadius: "var(--radius-lg)",
              padding: "28px 20px",
              marginBottom: 20,
              cursor: "pointer",
              background:
                uploadedCount > 0 ? "var(--accent-dim)" : "var(--bg-alt)",
              transition: "all 0.2s",
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();

              const droppedFiles = Array.from(
                event.dataTransfer.files
              );

              if (droppedFiles.length > 0) {
                handleFolderUpload({
                  target: { files: droppedFiles, value: "" },
                });
              }
            }}
          >
            <input
              type="file"
              webkitdirectory="true"
              multiple
              accept=".nii,.nii.gz"
              hidden
              onChange={handleFolderUpload}
            />

            <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>

            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              {uploadedCount > 0
                ? `${uploadedCount} / ${MRI_SEQUENCES.length} files matched`
                : "Upload Patient Folder"}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              Click to select the entire patient folder — files will be
              matched automatically by filename
            </div>

            {uploadedCount > 0 &&
              uploadedCount < MRI_SEQUENCES.length && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--warning)",
                    fontWeight: 600,
                  }}
                >
                  ⚠ {MRI_SEQUENCES.length - uploadedCount} files not yet
                  matched — use individual slots below
                </div>
              )}

            {allUploaded && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--success)",
                  fontWeight: 700,
                }}
              >
                ✓ All 14 sequences matched and ready
              </div>
            )}

            {uploadedCount === 0 && (
              <span
                style={{
                  padding: "8px 20px",
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: "var(--radius)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Select Folder
              </span>
            )}
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: "var(--border)",
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              or upload individual files below
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "var(--border)",
              }}
            />
          </div>

          <div className="upload-count-badge">
            <strong>
              {uploadedCount} / {MRI_SEQUENCES.length}
            </strong>{" "}
            sequences uploaded
            {allUploaded && (
              <span
                style={{
                  color: "var(--success)",
                  marginLeft: 10,
                  fontWeight: 700,
                }}
              >
                ✓ All ready
              </span>
            )}
          </div>

          <div className="mri-upload-grid">
            {MRI_SEQUENCES.map((sequence) => (
              <div
                key={sequence.key}
                className={`mri-seq-card ${
                  files[sequence.key] ? "uploaded" : ""
                } ${sequence.key === "SEG" ? "seg-card" : ""}`}
              >
                <div className="seq-label">{sequence.label}</div>
                <div className="seq-hint">{sequence.hint}</div>

                {files[sequence.key] ? (
                  <>
                    <div className="seq-filename">
                      {files[sequence.key].name}
                    </div>

                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${fileProgress[sequence.key] || 0}%`,
                        }}
                      />
                    </div>

                    <span className="seq-status">
                      {(fileProgress[sequence.key] || 0) < 100
                        ? `${fileProgress[sequence.key] || 0}%`
                        : "✓ Done"}
                    </span>

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setFiles((current) => {
                          const next = { ...current };
                          delete next[sequence.key];
                          return next;
                        });

                        setFileProgress((current) => {
                          const next = { ...current };
                          delete next[sequence.key];
                          return next;
                        });
                      }}
                    >
                      Replace
                    </button>
                  </>
                ) : (
                  <label
                    className={`upload-btn-sm ${
                      sequence.key === "SEG" ? "upload-btn-seg" : ""
                    }`}
                  >
                    + Upload
                    <input
                      type="file"
                      accept=".nii,.nii.gz"
                      hidden
                      onChange={(event) =>
                        handleFileSelect(sequence.key, event)
                      }
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button
              className="btn-ghost"
              onClick={() => setStep(1)}
              disabled={saving}
            >
              ← Back
            </button>

            <button
              className="btn-primary"
              onClick={startAnalysis}
              disabled={!allUploaded || saving}
              style={{
                opacity: allUploaded && !saving ? 1 : 0.5,
              }}
            >
              {saving
                ? "⬆ Uploading files to server…"
                : "🔬 Start Analysis"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card processing-card">
          <h3>
            {done
              ? "✅ Analysis Complete"
              : "🔬 Analyzing MRI Scans…"}
          </h3>

          {!done && (
            <p className="hint">
              Do not close this page while processing.
            </p>
          )}

          <div className="overall-progress">
            <div className="overall-bar">
              <div
                className="overall-fill"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <span className="overall-pct">{overallProgress}%</span>
          </div>

          <div className="pipeline-steps">
            {PIPELINE.map((pipelineStep) => {
              const found = processingSteps.find(
                (item) => item.id === pipelineStep.id
              );

              const status = found ? found.status : "pending";

              return (
                <div
                  key={pipelineStep.id}
                  className={`pipeline-step ${status}`}
                >
                  <div className="pipeline-dot">
                    {status === "done"
                      ? "✓"
                      : status === "running"
                        ? "…"
                        : ""}
                  </div>

                  <div>
                    <div className="pipeline-label">
                      {pipelineStep.label}
                    </div>
                    <div className="pipeline-sub">
                      {pipelineStep.sub}{" "}
                      <em>
                        ({pipelineStep.range[0]}–
                        {pipelineStep.range[1]}%)
                      </em>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {done && (
            <div style={{ marginTop: 24 }}>
              {isFollowUp && (
                <button
                  className="btn-primary"
                  style={{ marginRight: 10 }}
                  onClick={() => nav("doctorDashboard")}
                >
                  📅 Back to Case
                </button>
              )}

              <button
                className={isFollowUp ? "btn-ghost" : "btn-primary"}
                onClick={() => nav("doctorSelect")}
              >
                📋 Go to Case List
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
