import { STATUS, OUTCOME, DEPTH_LABEL } from "../constants";
import { ago } from "../utils";

export function StatusBadge({ status }) {
  const s = STATUS[status];
  return <span className={`badge ${status}`}>{s ? `${s.icon} ${s.label}` : status}</span>;
}

export function OutcomeBadge({ outcome }) {
  return <span className={`badge ${outcome}`}>{OUTCOME[outcome]?.label || outcome}</span>;
}

export function Evidence({ items }) {
  if (!items || !items.length) return null;
  return (
    <ul className="evidence">
      {items.map(x => (
        <li key={x.key}>
          <b>{x.label}</b>
          <div className="meter" title="How strongly this supports the report">
            <i style={{ width: `${Math.round(100 * (+x.score || 0))}%` }} />
          </div>
          <small>{x.detail}</small>
        </li>
      ))}
    </ul>
  );
}

// Full report card body: outcome, confidence, explanation, photo, evidence breakdown
export function ReportBody({ r, open = false }) {
  const pct = r.confidence == null ? null : Math.round(r.confidence * 100);
  return (
    <>
      <p>
        <OutcomeBadge outcome={r.verification_status} />{" "}
        {r.report_type === "cleared" ? "Water cleared" : "Waterlogged"} · {DEPTH_LABEL[r.water_depth] || r.water_depth} ·{" "}
        <span className="meta">{ago(r.created_at)}</span>
      </p>
      {pct != null && (
        <>
          <div className="meta">Confidence {pct}%</div>
          <div className="meter"><i style={{ width: `${pct}%` }} /></div>
        </>
      )}
      <p>{r.explanation || "Awaiting verification."}</p>
      {r.photo_url && <img className="thumb" src={r.photo_url} alt="Submitted photo" />}
      {r.evidence && r.evidence.length > 0 && (
        <details open={open}>
          <summary>Why this decision</summary>
          <Evidence items={r.evidence} />
        </details>
      )}
    </>
  );
}

export function ReportMini({ r }) {
  return (
    <div className="meta">
      <OutcomeBadge outcome={r.verification_status} /> {r.report_type === "cleared" ? "Cleared" : "Waterlogged"} ·{" "}
      {DEPTH_LABEL[r.water_depth] || r.water_depth} · {ago(r.created_at)}
      <br />
      {r.explanation}
    </div>
  );
}
