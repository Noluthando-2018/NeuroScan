import Avatar from "../components/Avatar";

// Profile screen — same layout as the mobile app: avatar, name, role badge, info card, logout.
export default function ProfilePage({ userProfile, onLogout }) {
  if (!userProfile) return null;
  const isDoctor = userProfile.role === "doctor";

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>My Profile</h2><p className="subtitle">Your account details</p></div>
      </div>

      <div className="profile-wrap">
        <div className="profile-hero">
          <Avatar name={userProfile.full_name} size={96} />
          <h3 className="profile-name">{userProfile.full_name}</h3>
          <span className={`badge ${isDoctor ? "badge-blue" : "badge-green"}`}>
            {isDoctor ? "Doctor" : "Patient"}
          </span>
        </div>

        <div className="card profile-info">
          <InfoRow label="Email" value={userProfile.email} />
          {isDoctor && userProfile.hospital && (
            <>
              <hr className="profile-divider" />
              <InfoRow label="Hospital" value={userProfile.hospital} />
            </>
          )}
          {isDoctor && userProfile.city && (
            <>
              <hr className="profile-divider" />
              <InfoRow label="City" value={userProfile.city} />
            </>
          )}
        </div>

        <button className="btn-ghost profile-logout" onClick={onLogout}>⇦ Logout</button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="profile-row">
      <span className="profile-row-label">{label}</span>
      <span className="profile-row-value">{value}</span>
    </div>
  );
}
