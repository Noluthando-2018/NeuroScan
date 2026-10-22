import { useMemo } from "react";
import { TURKEY_CITIES } from "../data/turkeyCities";
import hospitalsByCity from "../data/hospitals.json";   // { "Konya": ["Konya Şehir Hastanesi", ...], ... }  (built by scripts/build_hospitals.py)

/**
 * City dropdown (81 provinces) + hospital field with suggestions for the chosen city.
 * The hospital stays free text on purpose: private clinics / new hospitals may not be in the list.
 */
export default function CityHospitalFields({ city, hospital, onChange }) {
  const options = useMemo(() => hospitalsByCity[city] ?? [], [city]);

  return (
    <>
      <div className="form-group">
        <label>City</label>
        <select value={city} onChange={e => onChange(e.target.value, "")}>
          <option value="">Select your city…</option>
          {TURKEY_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Hospital / Institution</label>
        <input
          type="text" list="hospital-options" disabled={!city} value={hospital}
          placeholder={!city ? "Select a city first" : options.length ? "Select from the list or type…" : "Type your hospital or institution"}
          onChange={e => onChange(city, e.target.value)}
        />
        <datalist id="hospital-options">
          {options.map(h => <option key={h} value={h} />)}
        </datalist>
        {city && options.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {options.length} hospitals listed for {city}. Not in the list? Just type its name.
          </div>
        )}
      </div>
    </>
  );
}
