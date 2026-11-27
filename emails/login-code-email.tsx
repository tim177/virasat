import { en } from "@/lib/i18n/en";

import { EmailLayout, heading, muted, text } from "./layout";
import { emailColors as c, emailFonts as f } from "./theme";

const t = en.email.loginCode;

/** The 6-digit sign-in code for customer login (/login). */
export function LoginCodeEmail({ code, minutes }: { code: string; minutes: number }) {
  return (
    <EmailLayout preview={t.preview(minutes)}>
      <h1 style={heading}>{t.title}</h1>
      <p style={text}>{t.intro}</p>
      <p
        data-login-code={code}
        style={{
          margin: "20px 0",
          padding: "16px",
          fontFamily: f.body,
          fontSize: "32px",
          fontWeight: 600,
          letterSpacing: "8px",
          textAlign: "center",
          color: c.charcoal,
          backgroundColor: c.sand,
        }}
      >
        {code}
      </p>
      <p style={text}>{t.expires(minutes)}</p>
      <p style={muted}>{t.notYou}</p>
    </EmailLayout>
  );
}
