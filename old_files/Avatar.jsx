// Profile picture: a circle showing the user's first initial (same look as the mobile app).
// toLocaleUpperCase("tr-TR") keeps Turkish letters correct, e.g. "ışık" → "I", "izmir" → "İ".
export default function Avatar({ name = "", size = 76 }) {
  const initial = name.trim() ? Array.from(name.trim())[0].toLocaleUpperCase("tr-TR") : "?";
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      role="img"
      aria-label={name ? `Profile picture of ${name}` : "Profile picture"}
    >
      {initial}
    </div>
  );
}
