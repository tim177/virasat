import type { CSSProperties, ReactNode } from "react";

import { en } from "@/lib/i18n/en";

import { emailColors as c, emailFonts as f } from "./theme";

// Shared frame for every Virasat email: a centered 600px card, table-based for email clients.

export const text: CSSProperties = {
  margin: "0 0 12px",
  fontFamily: f.body,
  fontSize: "15px",
  lineHeight: "1.6",
  color: c.charcoal,
};

export const muted: CSSProperties = { ...text, fontSize: "13px", color: c.stone700 };

export const heading: CSSProperties = {
  margin: "0 0 12px",
  fontFamily: f.display,
  fontSize: "26px",
  lineHeight: "1.25",
  fontWeight: 500,
  color: c.charcoal,
};

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <html lang="en">
      {/* Emails are standalone HTML documents, not Next.js pages. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: c.ivory }}>
        {/* Preview text shown next to the subject in the inbox. */}
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>{preview}</div>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: c.ivory }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "32px 16px" }}>
                <table
                  role="presentation"
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    maxWidth: "600px",
                    backgroundColor: c.white,
                    border: `1px solid ${c.line}`,
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "28px 32px 8px", textAlign: "center" }}>
                        <p style={{ ...heading, fontSize: "28px", margin: 0 }}>{en.site.name}</p>
                        <div
                          style={{
                            height: "1px",
                            backgroundColor: c.gold500,
                            margin: "16px auto 0",
                            width: "120px",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "24px 32px 32px" }}>{children}</td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ ...muted, textAlign: "center", marginTop: "16px" }}>
                  {en.email.footer}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
