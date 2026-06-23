interface JsonPanelProps {
  title: string;
  value: unknown;
}

export function JsonPanel({ title, value }: JsonPanelProps) {
  const json = JSON.stringify(value, null, 2);
  return (
    <details className="json-panel">
      <summary>{title}</summary>
      <div className="json-actions">
        <button type="button" className="secondary" onClick={() => navigator.clipboard.writeText(json)}>
          Copy JSON
        </button>
      </div>
      <pre>{json}</pre>
    </details>
  );
}
