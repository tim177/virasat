import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Short label for logs and Resend tags, e.g. "order-confirmation". */
  tag: string;
};

/**
 * Sends an email through Resend. Without RESEND_API_KEY (local development, tests), the email
 * is written to .outbox/ instead so you can open it in a browser. On the live server a missing
 * key is an error unless EMAIL_OUTBOX=true, so emails are never silently dropped.
 */
export async function sendEmail(message: EmailMessage): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Virasat <orders@example.com>",
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: [{ name: "type", value: message.tag }],
    });
    if (error) throw new Error(`Resend failed: ${error.message}`);
    return { id: data?.id ?? "" };
  }

  if (process.env.NODE_ENV === "production" && process.env.EMAIL_OUTBOX !== "true") {
    throw new Error("RESEND_API_KEY is not set, so emails can't be sent.");
  }

  const dir = path.join(process.cwd(), ".outbox");
  await mkdir(dir, { recursive: true });
  const safeTo = message.to.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  const file = `${Date.now()}-${message.tag}-${safeTo}.html`;
  await writeFile(path.join(dir, file), message.html, "utf8");
  console.info(`[email] ${message.tag} → ${message.to}: saved to .outbox/${file}`);
  return { id: `outbox:${file}` };
}
