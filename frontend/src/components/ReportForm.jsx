import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { CONFIG } from "../config";
import { DEPTHS } from "../constants";
import { ReportBody } from "./ui";

export default function ReportForm({ pin, onLocate, onSubmitted }) {
  const [type, setType] = useState("waterlogged");
  const [depth, setDepth] = useState("ankle");
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const cleared = type === "cleared";
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const changeType = t => { setType(t); setDepth(t === "cleared" ? "none" : "ankle"); };

  const pickPhoto = e => {
    const f = e.target.files[0];
    setPhoto(null);
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { e.target.value = ""; return setError("Please choose a JPEG, PNG or WebP image."); }
    if (f.size > CONFIG.MAX_PHOTO_MB * 1048576) { e.target.value = ""; return setError(`Photo must be under ${CONFIG.MAX_PHOTO_MB} MB.`); }
    setError(""); setPhoto(f);
  };

  const geolocate = () => {
    if (!navigator.geolocation) return setError("Location is not available in this browser.");
    navigator.geolocation.getCurrentPosition(
      p => onLocate({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Couldn't get your location. Tap the map instead."),
      { timeout: 8000 }
    );
  };

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    if (!pin) return setError("Please tap the map (or use your location) to place a pin.");
    setError(""); setBusy(true);
    try {
      const rep = await api.submitReport({ lat: pin.lat, lng: pin.lng, report_type: type, water_depth: depth, photo });
      setResult(rep);
      onSubmitted(rep);
      setType("waterlogged"); setDepth("ankle"); setPhoto(null);
      e.target.reset();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="tabpane">
      <h2 className="h2">Submit a report</h2>
      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend>What are you seeing?</legend>
          <div className="seg">
            <label><input type="radio" name="report_type" checked={!cleared} onChange={() => changeType("waterlogged")} /><span>💧 Area is waterlogged</span></label>
            <label><input type="radio" name="report_type" checked={cleared} onChange={() => changeType("cleared")} /><span>✔ Water has cleared</span></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Where?</legend>
          <p className={"pin-text" + (pin ? " set" : "")}>
            {pin ? `Pin placed: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Tap the map to place your pin, or drag it."}
          </p>
          <button type="button" className="btn btn-ghost" onClick={geolocate}>📍 Use my location</button>
        </fieldset>

        <fieldset>
          <legend>Water depth (approx.)</legend>
          <div className="chips">
            {DEPTHS.map(d => (
              <label key={d.v}>
                <input type="radio" name="water_depth" value={d.v} checked={depth === d.v} disabled={cleared !== (d.v === "none")} onChange={() => setDepth(d.v)} />
                <span>{d.l}<small>{d.s}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Photo <span className="opt">(optional)</span></legend>
          <input type="file" id="photo" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} />
          {preview && <img id="photo-preview" src={preview} alt="Photo preview" />}
          <p className="note">Stored as supporting evidence only. It is not analysed automatically.</p>
        </fieldset>

        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Verifying…" : "Submit report"}</button>
      </form>

      {result && (
        <div className={`card result ${result.verification_status}`} style={{ marginTop: 16 }}>
          <h3>Report received</h3>
          <ReportBody r={result} open />
        </div>
      )}
    </section>
  );
}
