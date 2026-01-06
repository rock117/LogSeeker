export default function SettingsPage() {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <div className="hint">
        Next step: project settings (sources, default timezone <code>+08:00</code>, multiline rules).
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="hint">Default timestamp formats supported:</div>
        <pre>
{`2026-01-06T00:00:10.139126+08:00
2026-01-06T00:00:10 +08:00
2026-01-06T00:00:10`}
        </pre>
      </div>
    </div>
  )
}
