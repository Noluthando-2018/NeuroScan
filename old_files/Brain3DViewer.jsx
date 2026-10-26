import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

export default function Brain3DViewer({ caseId, visitId, visitLabel }) {
  const canvasRef   = useRef(null);
  const nv           = useRef(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [colormap, setColormap]   = useState("gray");
  const [showSeg, setShowSeg]     = useState(true);
  const [sliceType, setSliceType] = useState(2); // 2=render, 0=axial, 1=coronal, 3=sagittal

  useEffect(() => {
    loadNiiVue();

    // Watch container resize and tell NiiVue
    const observer = new ResizeObserver(() => {
      if (nv.current && canvasRef.current) {
        try {
          canvasRef.current.width  = canvasRef.current.offsetWidth;
          canvasRef.current.height = canvasRef.current.offsetHeight;
          nv.current.resizeListener();
        } catch { /* ignore */ }
      }
    });
    if (canvasRef.current?.parentElement) {
      observer.observe(canvasRef.current.parentElement);
    }

    return () => {
      observer.disconnect();
      if (nv.current) { try { nv.current.closeDrawing(); } catch { /* ignore */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, visitId]);

  const loadNiiVue = async () => {
    setLoading(true); setError("");
    try {
      // Load NiiVue via ESM dynamic import from jsDelivr
      if (!window._NiivueClass) {
        // Try multiple CDN approaches
        const cdnUrls = [
          "https://cdn.jsdelivr.net/npm/@niivue/niivue@0.38.0/dist/niivue.umd.js",
          "https://cdn.jsdelivr.net/npm/@niivue/niivue@0.36.0/dist/niivue.umd.js",
          "https://cdn.jsdelivr.net/npm/@niivue/niivue@0.34.0/dist/niivue.umd.js",
        ];

        let loaded = false;
        for (const url of cdnUrls) {
          try {
            await new Promise((resolve, reject) => {
              // Remove any previous failed script
              const old = document.querySelector('script[data-niivue]');
              if (old) old.remove();
              const script = document.createElement("script");
              script.src = url;
              script.setAttribute("data-niivue", "true");
              script.onload = () => {
                // NiiVue UMD can expose itself in different ways
                if (window.Niivue) {
                  window._NiivueClass = window.Niivue;
                  resolve();
                } else if (window.niivue?.Niivue) {
                  window._NiivueClass = window.niivue.Niivue;
                  resolve();
                } else {
                  // Try to find it in window keys
                  const key = Object.keys(window).find(k => {
                    try { return typeof window[k] === 'function' && window[k].toString().includes('attachToCanvas'); } catch { return false; }
                  });
                  if (key) { window._NiivueClass = window[key]; resolve(); }
                  else reject(new Error("Niivue class not found in window after script load"));
                }
              };
              script.onerror = reject;
              document.head.appendChild(script);
            });
            loaded = true;
            break;
          } catch(e) {
            console.warn("CDN failed:", url, e.message);
            continue;
          }
        }
        if (!loaded) throw new Error("Could not load NiiVue from any CDN source");
      }

      const NiivueClass = window._NiivueClass;

      // Fetch T1 and SEG file URLs from mri_uploads
      let uploadsQuery = supabase
        .from("mri_uploads")
        .select("sequence_name, file_url")
        .eq("case_id", caseId)
        .in("sequence_name", ["T1", "SEG"]);
      if (visitId) uploadsQuery = uploadsQuery.eq("visit_id", visitId);
      const { data: uploads } = await uploadsQuery;

      if (!uploads || uploads.length < 2) {
        setError("MRI files not found for this case. Please make sure T1 and Tumor Segmentation were uploaded.");
        setLoading(false); return;
      }

      const t1Row  = uploads.find(u => u.sequence_name === "T1");
      const segRow = uploads.find(u => u.sequence_name === "SEG");

      if (!t1Row?.file_url || !segRow?.file_url) {
        setError("File storage paths are missing. This case may have been created before file upload was enabled. Please add a new case with file uploads.");
        setLoading(false); return;
      }

      // Get signed URLs (1 hour expiry)
      const { data: t1Signed,  error: e1 } = await supabase.storage.from("mri-scans").createSignedUrl(t1Row.file_url,  3600);
      const { data: segSigned, error: e2 } = await supabase.storage.from("mri-scans").createSignedUrl(segRow.file_url, 3600);

      if (e1 || e2 || !t1Signed?.signedUrl || !segSigned?.signedUrl) {
        setError("Could not generate secure download links. Check Supabase Storage permissions.");
        setLoading(false); return;
      }

      // Destroy previous instance if any
      if (nv.current) { try { nv.current.closeDrawing(); } catch { /* ignore */ } nv.current = null; }

      // Init NiiVue
      const nvInstance = new NiivueClass({
        show3Dcrosshair: true,
        backColor: [0.07, 0.09, 0.12, 1],
        crosshairColor: [0.35, 0.8, 1, 0.9],
        isColorbar: false,
      });
      nv.current = nvInstance;

      await nvInstance.attachToCanvas(canvasRef.current);
      await nvInstance.loadVolumes([
        { url: t1Signed.signedUrl,  colormap: "gray", opacity: 1.0 },
        { url: segSigned.signedUrl, colormap: "red",  opacity: 0.6, cal_min: 0.5, cal_max: 1.5 },
      ]);

      nvInstance.setSliceType(2); // 3D render

      // Force resize after React re-render so canvas has correct dimensions
      setTimeout(() => {
        try {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width  = canvas.offsetWidth  || 1200;
            canvas.height = canvas.offsetHeight || 520;
            nvInstance.resizeListener();
            nvInstance.drawScene();
          }
        } catch(e) { console.warn("resize hint failed:", e); }
      }, 100);

      setLoading(false);
    } catch (err) {
      console.error("NiiVue error:", err);
      setError("Failed to load 3D viewer: " + err.message);
      setLoading(false);
    }
  };

  const setColormapAndUpdate = (cm) => {
    setColormap(cm);
    if (nv.current) {
      nv.current.volumes[0].colormap = cm;
      nv.current.updateGLVolume();
    }
  };

  const toggleSegmentation = () => {
    if (!nv.current || nv.current.volumes.length < 2) return;
    const next = !showSeg;
    setShowSeg(next);
    nv.current.volumes[1].opacity = next ? 0.6 : 0;
    nv.current.updateGLVolume();
  };

  const changeSliceType = (type) => {
    setSliceType(type);
    if (nv.current) nv.current.setSliceType(type);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "14px 20px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-alt)"
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginRight: 4 }}>
          🧠 3D Brain Viewer
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {[
            { label: "3D",       val: 2 },
            { label: "Axial",    val: 0 },
            { label: "Coronal",  val: 1 },
            { label: "Sagittal", val: 3 },
          ].map(v => (
            <button key={v.val} onClick={() => changeSliceType(v.val)} style={{
              padding: "5px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--border)", fontFamily: "inherit", fontWeight: 600,
              background: sliceType === v.val ? "var(--accent)" : "var(--surface)",
              color: sliceType === v.val ? "#fff" : "var(--text-secondary)",
            }}>{v.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {["gray","hot","viridis","inferno"].map(cm => (
            <button key={cm} onClick={() => setColormapAndUpdate(cm)} style={{
              padding: "5px 10px", fontSize: 11, borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--border)", fontFamily: "inherit", textTransform: "capitalize",
              background: colormap === cm ? "var(--accent-dim)" : "var(--surface)",
              color: colormap === cm ? "var(--accent-dark)" : "var(--text-muted)",
              fontWeight: colormap === cm ? 700 : 400,
            }}>{cm}</button>
          ))}
        </div>

        <button onClick={toggleSegmentation} style={{
          padding: "5px 14px", fontSize: 12, borderRadius: 6, cursor: "pointer",
          border: `1px solid ${showSeg ? "var(--danger)" : "var(--border)"}`,
          background: showSeg ? "rgba(192,57,43,0.08)" : "var(--surface)",
          color: showSeg ? "var(--danger)" : "var(--text-muted)",
          fontFamily: "inherit", fontWeight: 600,
        }}>
          {showSeg ? "🔴 Hide Tumor" : "○ Show Tumor"}
        </button>

        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
          Drag to rotate · Scroll to zoom · Right-click to pan
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ position: "relative", background: "#0d1117", minHeight: 520 }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "#0d1117", zIndex: 10
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🧠</div>
            <div style={{ color: "#7ecff4", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
              Loading MRI Volume…
            </div>
            <div style={{ color: "#4a6a80", fontSize: 12, marginBottom: 20 }}>
              Fetching T1 scan and tumor segmentation
            </div>
            <div style={{
              width: 200, height: 4, background: "#1e2d3d",
              borderRadius: 4, overflow: "hidden"
            }}>
              <div style={{
                height: "100%", background: "#0b9faa",
                borderRadius: 4, animation: "pulse 1.4s ease-in-out infinite"
              }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "#0d1117", zIndex: 10, padding: 32, textAlign: "center"
          }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
            <div style={{ color: "#e74c3c", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              Could not load viewer
            </div>
            <div style={{ color: "#7a90a4", fontSize: 13, maxWidth: 400, lineHeight: 1.6 }}>
              {error}
            </div>
            <button onClick={loadNiiVue} style={{
              marginTop: 20, padding: "8px 20px", background: "var(--accent)",
              color: "#fff", border: "none", borderRadius: 8,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600
            }}>↻ Retry</button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={1200}
          height={520}
          style={{
            width: "100%", height: 520,
            display: loading || error ? "none" : "block"
          }}
        />
      </div>

      {/* Legend */}
      {!loading && !error && (
        <div style={{
          display: "flex", gap: 20, padding: "10px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "#0d1117"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#7a90a4" }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "#aaa" }} />
            T1 Brain Volume
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#7a90a4" }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "#e74c3c" }} />
            Tumor Segmentation
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#4a6a80" }}>
            Case {caseId}{visitLabel ? ` · ${visitLabel}` : ""} · NiiVue renderer
          </div>
        </div>
      )}
    </div>
  );
}

