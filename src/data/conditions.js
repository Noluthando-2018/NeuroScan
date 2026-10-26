// Conditions the platform can analyse. A case stores its condition in cases.condition ("tumor" | "alzheimer").
// Cases created before Alzheimer's support have no value and are treated as "tumor".

export const conditionOf = (c) => (c?.condition === "alzheimer" ? "alzheimer" : "tumor");

export const CONDITIONS = {
  tumor:     { key: "tumor",     label: "Brain Tumor",       short: "Tumor",     icon: "🧠", badge: "badge-blue"   },
  alzheimer: { key: "alzheimer", label: "Alzheimer's Disease", short: "Alzheimer's", icon: "🧩", badge: "badge-orange" },
};

// Sequences required for an Alzheimer's analysis (structural MRI). Tumor cases keep their own list in AddNewCase.
export const ALZ_SEQUENCES = [
  { key: "T1", label: "T1 (MPRAGE)", hint: "_T1.nii.gz" },
];

export const ALZ_PIPELINE = [
  { id: 1, label: "Preprocessing",        sub: "Skull stripping, registration, bias-field correction...", range: [10, 30] },
  { id: 2, label: "Upload Complete",      sub: "Files received successfully",                             range: [30, 30] },
  { id: 3, label: "Classification",       sub: "Running CDR 0 / CDR > 0 classifier...",                   range: [30, 50] },
  { id: 4, label: "Tissue Segmentation",  sub: "Segmenting CSF, gray and white matter...",                range: [50, 70] },
  { id: 5, label: "Volumetric Measures",  sub: "Computing nWBV and brain volume...",                      range: [70, 85] },
  { id: 6, label: "Explainable AI",       sub: "Generating Grad-CAM heatmap...",                          range: [85, 95] },
  { id: 7, label: "Report Generation",    sub: "Saving results...",                                       range: [95, 100] },
];

// Placeholder results shown in the dashboards until the real Alzheimer's model is connected
// (the same way the tumor dashboard currently shows sample values).
export const ALZHEIMER_DATA = {
  diagnosis: "Alzheimer's Disease",
  stage: "Mild (CDR 1)",
  risk: "Moderate",
  probabilities: [
    { name: "Alzheimer's Disease (AD)",       value: 68 },
    { name: "Mild Cognitive Impairment (MCI)", value: 24 },
    { name: "Cognitively Normal (CN)",         value: 8 },
  ],
  markers: [
    { label: "Disease Stage",              value: "Mild (CDR 1)",   alert: true },
    { label: "Hippocampal Volume",         value: "Low (−2.1 SD)",  alert: true },
    { label: "Entorhinal Cortex",          value: "Thinned (1.9 mm)"            },
    { label: "Ventricular Volume",         value: "Mildly enlarged"             },
    { label: "Medial Temporal Atrophy",    value: "MTA grade 3"                 },
  ],
  xaiFeatures: [
    { name: "Hippocampal Volume",          importance: 94 },
    { name: "Entorhinal Cortex Thickness", importance: 81 },
    { name: "Ventricular Volume",          importance: 69 },
    { name: "Age",                         importance: 58 },
    { name: "Medial Temporal Atrophy",     importance: 47 },
  ],
};

// Wording used for the doctor's "Patient View Controls" and the patient's cards.
// The database keys stay the same for both conditions; only the labels change.
export const VISIBILITY_COPY = {
  tumor: {
    scan_findings:            { label: "Scan Findings",            desc: "General description of detected region" },
    growth_pattern:           { label: "Growth Pattern",           desc: "Tumor growth characteristics" },
    treatment_considerations: { label: "Treatment Considerations", desc: "General treatment info" },
    surgical_assessment:      { label: "Surgical Assessment",      desc: "Resectability and surgery info" },
    next_steps:               { label: "Next Steps",               desc: "Follow-up and appointment guidance" },
    tumor_type:               { label: "Tumor Type & Name",        desc: "AI-predicted tumor classification" },
    clinical_markers:         { label: "Clinical Markers",         desc: "IDH, MGMT, tumor grade" },
    xai_explanation:          { label: "AI Explanation (XAI)",     desc: "Feature importance chart" },
  },
  alzheimer: {
    scan_findings:            { label: "Scan Findings",            desc: "General description of brain changes seen" },
    growth_pattern:           { label: "Progression Pattern",      desc: "How the changes may develop over time" },
    treatment_considerations: { label: "Treatment Considerations", desc: "General treatment and medication info" },
    surgical_assessment:      { label: "Care Planning",            desc: "Support, safety and care-planning guidance" },
    next_steps:               { label: "Next Steps",               desc: "Follow-up and appointment guidance" },
    tumor_type:               { label: "Diagnosis & Stage",        desc: "AI-predicted diagnosis and disease stage" },
    clinical_markers:         { label: "Brain Biomarkers",         desc: "Hippocampal volume, cortical thickness" },
    xai_explanation:          { label: "AI Explanation (XAI)",     desc: "Feature importance chart" },
  },
};

// Plain-language cards for the patient dashboard.
export const PATIENT_CARDS = {
  tumor: {
    scan_findings:            { icon: "🧠", title: "Scan Findings",            text: "An abnormal region was detected in your MRI scan. The AI has analyzed this region to help your medical team." },
    growth_pattern:           { icon: "📈", title: "Growth Pattern",           text: "Based on imaging features, the detected region may belong to a faster-developing group. Your doctor will discuss this." },
    treatment_considerations: { icon: "💊", title: "Treatment Considerations", text: "Some treatments may be more or less effective based on imaging findings. Your doctor will outline the best options." },
    surgical_assessment:      { icon: "🏥", title: "Surgical Assessment",      text: "A significant portion of the affected area may be accessible for surgical intervention. Your team will evaluate this." },
    next_steps:               { icon: "⏳", title: "Next Steps",               text: "Your doctor will explain everything in your upcoming consultation. Please attend all scheduled appointments." },
  },
  alzheimer: {
    scan_findings:            { icon: "🧠", title: "Scan Findings",            text: "Your MRI shows changes in areas of the brain linked to memory, such as the hippocampus. The AI measured these areas to help your medical team." },
    growth_pattern:           { icon: "📈", title: "Progression Pattern",      text: "These changes usually develop slowly over time. Your doctor will explain what to expect and how often to repeat the scan." },
    treatment_considerations: { icon: "💊", title: "Treatment Considerations", text: "There are treatments and daily-life strategies that can help manage symptoms. Your doctor will discuss which options suit you." },
    surgical_assessment:      { icon: "🤝", title: "Care Planning",            text: "Your care team can help you and your family plan support, safety at home and daily routines. Ask them about available services." },
    next_steps:               { icon: "⏳", title: "Next Steps",               text: "Your doctor will explain everything in your upcoming consultation. Please attend all scheduled appointments." },
  },
};
