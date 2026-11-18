import { useState } from "react";
import { Badge, Button, Icon, Panel } from "../_shared/ui";
import "./styles.css";

type Scope = "chat" | "always";
type Grant = { scope: Scope; can: string[]; grantedAt: string } | null;

const READ = ["Read pages in the HR policy space"];
const READ_WRITE = ["Read pages in the HR policy space", "Create and edit pages in that space"];

export default function ConnectorConsent() {
  const [grant, setGrant] = useState<Grant>(null);
  const [scope, setScope] = useState<Scope>("chat");
  const [upgradeRequested, setUpgradeRequested] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const allow = () => {
    setGrant({ scope, can: READ, grantedAt: "just now" });
    setNote(null);
  };
  const revoke = () => {
    setGrant(null);
    setUpgradeRequested(false);
    setNote(null);
  };
  const approveUpgrade = () => {
    setGrant((g) => (g ? { ...g, can: READ_WRITE, grantedAt: "just now" } : g));
    setUpgradeRequested(false);
    setNote("Write access approved just now.");
  };
  const declineUpgrade = () => {
    setUpgradeRequested(false);
    setNote("Declined. Confluence stays read-only.");
  };

  return (
    <div className="lab-stack">
      {!grant && (
        <Panel title="Connect a tool">
          <div className="cc-request">
            <div className="cc-request-h">
              <span className="cc-icon" aria-hidden="true">C</span>
              <div>
                <p className="cc-t">Confluence wants to connect</p>
                <p className="lab-small lab-muted">So the assistant can cite your actual policy pages, not a guess.</p>
              </div>
            </div>
            <ul className="cc-can">
              {READ.map((c) => <li key={c}><Icon name="check" size={13} />{c}</li>)}
            </ul>

            <div className="cc-scope">
              <p className="lab-mono lab-muted cc-scope-k">Grant access</p>
              <div className="lab-row">
                <label className="cc-radio">
                  <input type="radio" name="scope" checked={scope === "chat"} onChange={() => setScope("chat")} />
                  Just this chat
                </label>
                <label className="cc-radio">
                  <input type="radio" name="scope" checked={scope === "always"} onChange={() => setScope("always")} />
                  Until I revoke it
                </label>
              </div>
            </div>

            <div className="lab-row">
              <Button variant="primary" onClick={allow}>Allow</Button>
              <Button variant="ghost">Deny</Button>
            </div>
          </div>
        </Panel>
      )}

      {grant && (
        <Panel title="Connected tools">
          <ul className="cc-inventory">
            <li className="cc-item">
              <span className="cc-icon" aria-hidden="true">C</span>
              <div className="lab-grow">
                <p className="cc-t">Confluence</p>
                <p className="lab-small lab-muted">{grant.can.join(" · ")}</p>
              </div>
              <Badge tone={grant.scope === "always" ? "agent" : "neutral"}>
                {grant.scope === "always" ? "Until revoked" : "This chat only"}
              </Badge>
              <Button size="sm" variant="ghost" onClick={revoke}>Revoke</Button>
            </li>
          </ul>

          {note && <p className="lab-small cc-note lab-in">{note}</p>}

          {!upgradeRequested && grant.can.length === READ.length && (
            <Button size="sm" variant="ghost" onClick={() => setUpgradeRequested(true)}>
              Simulate: Confluence asks for more access
            </Button>
          )}

          {upgradeRequested && (
            <div className="cc-upgrade lab-in">
              <Badge tone="warn">Permission change</Badge>
              <p className="lab-small">
                Confluence now also wants to <strong>create and edit pages</strong>, not just read them. That's a bigger grant than you approved, so it
                needs a fresh yes rather than expanding quietly.
              </p>
              <div className="lab-row">
                <Button size="sm" variant="primary" onClick={approveUpgrade}>Approve the expanded access</Button>
                <Button size="sm" onClick={declineUpgrade}>Keep it read-only</Button>
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
