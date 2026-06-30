import { Link, Navigate, useParams } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { useAppContext } from "../context/useAppContext";

export function ReferralPrint() {
  const { id } = useParams();
  const { getReferral } = useAppContext();
  const referral = id ? getReferral(id) : undefined;
  if (!referral) return <Navigate to="/referrals" replace />;
  const { draft } = referral;

  return (
    <div className="print-page">
      <div className="print-toolbar">
        <Link className="button secondary" to={`/referrals/${referral.id}`}>
          Back to referral
        </Link>
        <button type="button" onClick={() => window.print()}>Print referral</button>
      </div>
      <article className="print-sheet">
        <header>
          <div>
            <p className="eyebrow">Connectathon eReferral Demo</p>
            <h2>Referral Summary</h2>
            <code>{referral.localReferralId}</code>
          </div>
          <StatusBadge status={referral.status} />
        </header>

        <section>
          <h3>Patient information</h3>
          <PrintGrid
            items={[
              ["Name", referral.patientName],
              ["Birth date", draft.patient.birthDate],
              ["Gender", draft.patient.gender],
              ["PhilSys ID", draft.patient.philSysId || "Not recorded"],
              ["PhilHealth ID", draft.patient.philHealthId || "Not recorded"],
              ["Contact", draft.patient.phone || "Not recorded"],
              [
                "Address",
                [draft.patient.address.line, draft.patient.address.city, draft.patient.address.province]
                  .filter(Boolean)
                  .join(", ") || "Not recorded"
              ],
              [
                "Next of kin",
                [draft.patient.contactName, draft.patient.contactPhone]
                  .filter(Boolean)
                  .join(" - ") || "Not recorded"
              ]
            ]}
          />
        </section>

        <section>
          <h3>Referral routing</h3>
          <PrintGrid
            items={[
              ["Referring facility", referral.referringOrganizationName],
              ["Receiving facility", referral.receivingOrganizationName],
              ["Referral date/time", new Date(draft.authoredOn).toLocaleString()],
              ["Time called", new Date(draft.timeCalled).toLocaleString()],
              ["Category", draft.referralCategory.display],
              ["Priority", draft.priority],
              ["Requested service", draft.requestedService.display],
              ["Clinical reason", draft.clinicalReason.display]
            ]}
          />
        </section>

        <section>
          <h3>Clinical information</h3>
          <PrintGrid
            items={[
              ["Chief complaint", draft.chiefComplaint],
              ["Clinical history", draft.clinicalHistory],
              ["Working impression", draft.workingImpressionText],
              [
                "Vital signs",
                `BP ${draft.vitals.systolic}/${draft.vitals.diastolic} mmHg; HR ${draft.vitals.heartRate}/min; RR ${draft.vitals.respiratoryRate}/min; SpO2 ${draft.vitals.oxygenSaturation}%; Temp ${draft.vitals.temperature} C; Weight ${draft.vitals.weight} kg`
              ],
              ["Treatment given", draft.treatment],
              ["Laboratory metadata", `${draft.labTitle}: ${draft.labConclusion}`],
              [
                "Diagnostic attachment",
                draft.labAttachmentBase64
                  ? `${draft.labAttachmentName || "Attachment"} included (${draft.labAttachmentContentType || "application/octet-stream"})`
                  : draft.labAttachmentUrl
                    ? `${draft.labAttachmentName || "Attachment"} linked`
                  : "No attachment data included"
              ],
              ["Notes", draft.referralNarrative],
              ["Remarks", draft.remarks || "None"]
            ]}
          />
        </section>

        <section>
          <h3>Consent and signature</h3>
          <p>{draft.consentGiven ? draft.consentStatement : "Consent not recorded."}</p>
          <div className="signature-line">
            <span>
              {draft.referringPractitioner.prefix} {draft.referringPractitioner.given}{" "}
              {draft.referringPractitioner.family}
            </span>
            <small>Synthetic signature placeholder</small>
          </div>
        </section>
        <footer>
          Synthetic Connectathon data only. This printout is not for clinical use.
        </footer>
      </article>
    </div>
  );
}

function PrintGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="print-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
