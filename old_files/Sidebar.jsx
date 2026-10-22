export default function Sidebar({ page, userProfile, nav, onLogout }) {
  if (!userProfile) return null;
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">⬡</span>
        <span className="logo-text">NeuroScan</span>
      </div>
      <div className="sidebar-user">
        <div className="sidebar-avatar">{userProfile.full_name?.[0] ?? "?"}</div>
        <div>
          <div className="sidebar-name">{userProfile.full_name}</div>
          <div className="sidebar-role">{userProfile.role === "doctor" ? "🩺 Doctor" : "🏥 Patient"}</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {userProfile.role === "doctor" && (<>
          <button className={`nav-item ${page === "doctorSelect" ? "active" : ""}`} onClick={() => nav("doctorSelect")}>
            <span className="nav-icon">📋</span> Case List
          </button>
          <button className={`nav-item ${page === "addCase" ? "active" : ""}`} onClick={() => nav("addCase")}>
            <span className="nav-icon">➕</span> Add New Case
          </button>
        </>)}
        {userProfile.role === "patient" && (
          <button className={`nav-item ${page === "patientDashboard" ? "active" : ""}`} onClick={() => nav("patientDashboard")}>
            <span className="nav-icon">🏥</span> My Results
          </button>
        )}
      </nav>
      <button className="nav-item logout" onClick={onLogout}>
        <span className="nav-icon">⇦</span> Logout
      </button>
    </aside>
  );
}

