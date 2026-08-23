"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { CopyButton } from "@/components/ui/CopyButton";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { API_ORIGIN } from "@/lib/api";
import { useOrganization } from "@/context/OrganizationContext";

/**
 * Copy-pasteable integration snippets, resolved against the backend's own
 * origin (not the frontend's, and not the relative `/api/v1` the browser
 * uses internally) so the API docs link and widget snippet actually resolve.
 */
export function IntegrationGuide() {
  const { currentOrg } = useOrganization();
  const [tab, setTab] = useState("widget");

  const host = API_ORIGIN;
  const orgId = currentOrg?.id ?? "YOUR_ORGANIZATION_ID";

  const snippets: Record<string, { language: string; code: string }> = {
    widget: {
      language: "html",
      code: `<!-- Drop this before </body> on any page -->
<script
  src="${host}/static/widget.js"
  data-api-key="sk_live_your_key"
  defer
></script>`,
    },
    chat: {
      language: "bash",
      code: `# Stream an answer as a website visitor (API key auth)
curl -N -X POST ${host}/api/v1/widget/chat/stream \\
  -H "X-API-Key: $SUPPORTAI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"question": "Why was I charged twice?"}'`,
    },
    escalations: {
      language: "bash",
      code: `# List open urgent escalations (session token auth)
curl ${host}/api/v1/tickets \\
  -H "Authorization: Bearer $TOKEN" \\
  -G --data-urlencode "organization_id=${orgId}" \\
     --data-urlencode "status=OPEN" \\
     --data-urlencode "priority=URGENT"`,
    },
    verify: {
      language: "javascript",
      code: `// Verify an inbound webhook before trusting it
import crypto from "node:crypto";

export function isFromSupportAI(rawBody, signatureHeader, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(\`sha256=\${expected}\`),
    Buffer.from(signatureHeader),
  );
}`,
    },
  };

  const active = snippets[tab];

  return (
    <Panel>
      <PanelHeader
        title="Integration"
        description="Every dashboard action is a documented endpoint"
        action={
          <a
            href={`${host}/docs`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-accent-text hover:underline"
          >
            API docs
            <ExternalLink className="size-3" />
          </a>
        }
      />

      <Tabs
        items={[
          { id: "widget", label: "Widget" },
          { id: "chat", label: "Chat" },
          { id: "escalations", label: "Escalations" },
          { id: "verify", label: "Verify webhook" },
        ]}
        value={tab}
        onChange={setTab}
        className="px-3"
      />

      {Object.keys(snippets).map((id) => (
        <TabPanel key={id} id={id} active={id === tab}>
          <div className="relative">
            <div className="absolute right-3 top-3 z-10">
              <CopyButton value={active.code} />
            </div>
            <pre className="overflow-x-auto px-4 py-4 pr-24 font-mono text-[12px] leading-relaxed text-muted sm:px-5">
              <code>{active.code}</code>
            </pre>
            <div className="border-t border-line px-4 py-2 sm:px-5">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle">
                {active.language}
              </span>
            </div>
          </div>
        </TabPanel>
      ))}
    </Panel>
  );
}
