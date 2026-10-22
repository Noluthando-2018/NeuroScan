import React from "react";

export default function StatCard({ label, value, icon }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

// ─── Add New Case ─────────────────────────────────────────────────────────────
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

