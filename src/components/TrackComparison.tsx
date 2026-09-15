export function TrackComparison() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Capability</th>
            <th>Participant Starter</th>
            <th>Connectathon Ready</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Start command</td>
            <td><code>npm run dev</code></td>
            <td><code>npm run dev:ready</code></td>
          </tr>
          <tr>
            <td>Endpoint editing</td>
            <td>Public Participant Setup, <code>.env.participant.local</code>, or fork config</td>
            <td>Admin Settings, <code>.env.ready.local</code>, or the same fork config</td>
          </tr>
          <tr>
            <td>FHIR activity</td>
            <td>Remote reads, live terminology, Bundle preview, and <code>$validate</code></td>
            <td>The same reads plus guarded Organization, referral, and Task writes</td>
          </tr>
          <tr>
            <td>Write protection</td>
            <td>All external writes are blocked at the service boundary</td>
            <td>Writes require the ready preset and successful non-blocking validation</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
