import { ReportBody } from "./ui";

export default function MyReports({ ids, data }) {
  return (
    <section className="tabpane">
      <h2 className="h2">My reports</h2>
      {ids.map(id => data[id] && (
        <div key={id} className={`card result ${data[id].verification_status}`}>
          <ReportBody r={data[id]} />
        </div>
      ))}
      {!ids.length && <p className="note">You haven't submitted any reports from this browser yet.</p>}
      {ids.length > 0 && <p className="note">Pending reports update here automatically when they are rechecked.</p>}
    </section>
  );
}
