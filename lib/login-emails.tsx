import "server-only";

import { render } from "@react-email/render";

import { LoginCodeEmail } from "@/emails/login-code-email";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { en } from "@/lib/i18n/en";
import { rateLimit } from "@/lib/rate-limit";

/** How long a login code works. */
export const LOGIN_CODE_MINUTES = 10;

/** At most this many codes per email address per 15 minutes, so nobody can flood an inbox. */
const CODES_PER_EMAIL = 5;

/**
 * Emails a customer their sign-in code. Never throws: the login form says "check your email"
 * either way, so the response never reveals whether an address has an account.
 * Admin accounts never get codes: they sign in with a password and their authenticator app.
 */
export async function sendLoginCode(email: string, code: string): Promise<void> {
  try {
    const address = email.trim().toLowerCase();
    if (!rateLimit(`login-code:${address}`, CODES_PER_EMAIL, 15 * 60_000)) {
      console.warn("[email] login code not sent: too many codes for this address");
      return;
    }
    const user = await getDb().user.findUnique({
      where: { email: address },
      select: { role: true },
    });
    if (user?.role === "admin") {
      console.warn("[email] login code not sent: admin accounts use the admin sign-in");
      return;
    }
    const element = <LoginCodeEmail code={code} minutes={LOGIN_CODE_MINUTES} />;
    await sendEmail({
      to: address,
      subject: en.email.loginCode.subject(code),
      html: await render(element),
      text: await render(element, { plainText: true }),
      tag: "login-code",
    });
  } catch (error) {
    console.error("[email] login code failed", error);
  }
}
