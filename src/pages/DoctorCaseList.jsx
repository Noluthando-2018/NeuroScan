import { useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import StatCard from "../components/StatCard";
import { conditionOf, CONDITIONS } from "../data/conditions";

export default function DoctorCaseList({ cases, setSelectedCase, nav, onRefresh, toast }) {
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("active"); // "active" | "completed"
  const [refreshing, setRefreshing] = useState(false);
  const [conditionFilter, setConditionFilter] = useState("all"); // "all" | "tumor" | "alzheimer"

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const [result] = await Promise.all([onRefresh(), new Promise(r => setTimeout(r, 500))]);   // keep the spinner visible briefly
    setRefreshing(false);
    if (result?.ok === false) toast.error("Refresh failed", result.message);
    else toast.success("Cases refreshed", "Your case list is up to date.");
  };

  const riskBadge   = r => ({ High: "badge-red", Moderate: "badge-orange", Low: "badge-green" }[r] || "badge-blue");
  const statusBadge = s => s === "Done" ? "badge-green" : "badge-blue";

  // Patients per condition (shown in the dropdown)
  const conditionCounts = useMemo(() => ({
    all:       cases.length,
    tumor:     cases.filter(c => conditionOf(c) === "tumor").length,
    alzheimer: cases.filter(c => conditionOf(c) === "alzheimer").length,
  }), [cases]);

  // Condition dropdown first, then split into active (Processing) and completed (Done)
  const byCondition = useMemo(
    () => conditionFilter === "all" ? cases : cases.filter(c => conditionOf(c) === conditionFilter),
    [cases, conditionFilter]
  );
  const activeCases    = useMemo(() => byCondition.filter(c => c.status !== "Done"), [byCondition]);
  const completedCases = useMemo(() => byCondition.filter(c => c.status === "Done"),  [byCondition]);

  // Apply search filter to whichever tab is visible
  const sourceCases = activeTab === "active" ? activeCases : completedCases;
  const filteredCases = useMemo(() => {
    if (!search.trim()) return sourceCases;
    const q = search.toLowerCase();
    return sourceCases.filter(c =>
      c.patient_name?.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q)
    );
  }, [sourceCases, search]);

  const markComplete = async (caseId, e) => {
    e.stopPropagation();
    const { error } = await supabase
      .from("cases")
      .update({ status: "Done" })
      .eq("id", caseId);
    if (!error) { toast.success("Case completed!", `Case ${caseId} moved to Completed.`); onRefresh(); }
    else toast.error("Failed", error.message);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Case Management</h2>
          <p className="subtitle">Brain MRI cases assigned to you</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={handleRefresh} disabled={refreshing}>
            <span className={refreshing ? "spin" : ""} style={{ display: "inline-block" }}>↻</span> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn-primary" onClick={() => nav("addCase")}>➕ Add New Case</button>
        </div>
      </div>

      <div className="stats-row">
        <StatCard label="Total Cases" value={cases.length}                                         icon="📁" />
        <StatCard label="Completed"   value={completedCases.length}                                icon="✅" />
        <StatCard label="Processing"  value={activeCases.length}                                   icon="⏳" />
        <StatCard label="High Risk"   value={cases.filter(c => c.risk === "High").length}          icon="⚠️" />
      </div>

      {/* Search bar + condition dropdown */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "stretch" }}>
      <div style={{ position: "relative", flex: "1 1 280px" }}>
        <span style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          fontSize: 16, color: "var(--text-muted)", pointerEvents: "none"
        }}>🔍</span>
        <input
          type="text"
          placeholder="Search by patient name or case ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px 10px 40px",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
            fontSize: 14, fontFamily: "inherit", background: "var(--surface)",
            color: "var(--text-primary)", outline: "none", boxSizing: "border-box"
          }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 16, color: "var(--text-muted)", padding: 0
          }}>✕</button>
        )}
      </div>
      <select
        value={conditionFilter}
        onChange={e => setConditionFilter(e.target.value)}
        aria-label="Filter patients by condition"
        style={{
          width: "auto", minWidth: 220, padding: "10px 14px", fontSize: 14, fontFamily: "inherit",
          border: "1px solid var(--border)", borderRadius: "var(--radius)",
          background: "var(--surface)", color: "var(--text-primary)", cursor: "pointer",
        }}
      >
        <option value="all">All patients ({conditionCounts.all})</option>
        <option value="tumor">{CONDITIONS.tumor.icon} Brain Tumor patients ({conditionCounts.tumor})</option>
        <option value="alzheimer">{CONDITIONS.alzheimer.icon} Alzheimer's patients ({conditionCounts.alzheimer})</option>
      </select>
      </div>

      {/* Active / Completed tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        <button
          onClick={() => { setActiveTab("active"); setSearch(""); }}
          style={{
            padding: "8px 20px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: activeTab === "active" ? "var(--accent)" : "var(--surface)",
            color: activeTab === "active" ? "#fff" : "var(--text-secondary)"
          }}>
          ⏳ Active Cases
          <span style={{
            marginLeft: 8, padding: "2px 8px", borderRadius: 10, fontSize: 11,
            background: activeTab === "active" ? "rgba(255,255,255,0.25)" : "var(--bg-alt)",
            color: activeTab === "active" ? "#fff" : "var(--text-muted)"
          }}>{activeCases.length}</span>
        </button>
        <button
          onClick={() => { setActiveTab("completed"); setSearch(""); }}
          style={{
            padding: "8px 20px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: activeTab === "completed" ? "var(--success)" : "var(--surface)",
            color: activeTab === "completed" ? "#fff" : "var(--text-secondary)"
          }}>
          ✅ Completed Cases
          <span style={{
            marginLeft: 8, padding: "2px 8px", borderRadius: 10, fontSize: 11,
            background: activeTab === "completed" ? "rgba(255,255,255,0.25)" : "var(--bg-alt)",
            color: activeTab === "completed" ? "#fff" : "var(--text-muted)"
          }}>{completedCases.length}</span>
        </button>
      </div>

      <div className="card">
        {filteredCases.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 40 }}>
              {search || conditionFilter !== "all" ? "🔍" : activeTab === "active" ? "📋" : "✅"}
            </div>
            <p>
              {search
                ? `No cases match "${search}".`
                : conditionFilter !== "all"
                  ? `No ${activeTab === "active" ? "active" : "completed"} ${CONDITIONS[conditionFilter].label} cases.`
                : activeTab === "active"
                  ? "No active cases. Add your first case to get started."
                  : "No completed cases yet."}
            </p>
            {!search && conditionFilter === "all" && activeTab === "active" && (
              <button className="btn-primary" onClick={() => nav("addCase")} style={{ marginTop: 16 }}>
                ➕ Add New Case
              </button>
            )}
          </div>
        ) : (
          <>
            {search && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, fontStyle: "italic" }}>
                Showing {filteredCases.length} result{filteredCases.length !== 1 ? "s" : ""} for "{search}"
              </div>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case ID</th><th>Patient Name</th><th>Age / Sex</th>
                  <th>Last Scan</th><th>Visits</th><th>Status</th><th>Risk</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map(c => (
                  <tr key={c.id}>
                    <td><code>{c.id}</code></td>
                    <td><strong>{c.patient_name}</strong> <span className={`badge ${CONDITIONS[conditionOf(c)].badge}`} style={{ marginLeft: 6 }} title={CONDITIONS[conditionOf(c)].label}>{CONDITIONS[conditionOf(c)].icon} {CONDITIONS[conditionOf(c)].short}</span></td>
                    <td>{c.age} / {c.sex}</td>
                    <td>{c.scan_date}</td>
                    <td><span className="badge badge-blue">{c.visits?.[0]?.count ?? 1}</span></td>
                    <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                    <td><span className={`badge ${riskBadge(c.risk)}`}>{c.risk ?? "—"}</span></td>
                    <td style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <button className="btn-sm" onClick={() => { setSelectedCase(c); nav("doctorDashboard"); }}>View</button>
                      <button className="btn-sm" title="Add a follow-up visit"
                        onClick={() => { setSelectedCase(c); nav("addVisit"); }}>
                        ＋ Visit
                      </button>
                      {activeTab === "active" && (
                        <button className="btn-sm" style={{ borderColor: "var(--success)", color: "var(--success)" }}
                          onClick={(e) => markComplete(c.id, e)}>
                          ✓ Complete
                        </button>
                      )}
                      {c.patient_id
                        ? <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700 }}>✓ Linked</span>
                        : <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>⏳ Pending</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}