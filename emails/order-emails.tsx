import type { CSSProperties } from "react";

import { en } from "@/lib/i18n/en";
import { formatCents } from "@/lib/money";

import { EmailLayout, heading, muted, text } from "./layout";
import { emailColors as c } from "./theme";

export type EmailOrder = {
  number: string;
  customerName: string;
  email: string;
  shippingAddress: {
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
  };
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  items: Array<{
    title: string;
    size: string | null;
    isCustom: boolean;
    quantity: number;
    unitPriceCents: number;
  }>;
};

const t = en.email;
const cell: CSSProperties = {
  ...text,
  margin: 0,
  padding: "10px 0",
  borderBottom: `1px solid ${c.line}`,
};
const amountCell: CSSProperties = { ...cell, textAlign: "right", whiteSpace: "nowrap" };

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function ItemsTable({ order }: { order: EmailOrder }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ margin: "8px 0 16px" }}
    >
      <tbody>
        {order.items.map((item, index) => (
          <tr key={index}>
            <td style={cell}>
              <strong>{item.title}</strong>
              <br />
              <span style={{ color: c.stone700, fontSize: "13px" }}>
                {item.isCustom ? t.customFit : t.size(item.size ?? "")} · {t.qty(item.quantity)}
              </span>
            </td>
            <td style={amountCell}>{formatCents(item.unitPriceCents * item.quantity)}</td>
          </tr>
        ))}
        <tr>
          <td style={{ ...cell, color: c.stone700 }}>{t.subtotal}</td>
          <td style={amountCell}>{formatCents(order.subtotalCents)}</td>
        </tr>
        {order.discountCents > 0 ? (
          <tr>
            <td style={{ ...cell, color: c.stone700 }}>{t.discount}</td>
            <td style={amountCell}>−{formatCents(order.discountCents)}</td>
          </tr>
        ) : null}
        <tr>
          <td style={{ ...cell, color: c.stone700 }}>{t.shipping}</td>
          <td style={amountCell}>
            {order.shippingCents === 0 ? t.shippingFree : formatCents(order.shippingCents)}
          </td>
        </tr>
        <tr>
          <td style={{ ...cell, color: c.stone700 }}>{t.duties}</td>
          <td style={amountCell}>{t.dutiesIncluded}</td>
        </tr>
        <tr>
          <td style={{ ...cell, borderBottom: "none", fontWeight: 600 }}>{t.total}</td>
          <td style={{ ...amountCell, borderBottom: "none", fontWeight: 600 }}>
            {formatCents(order.totalCents)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Address({ order }: { order: EmailOrder }) {
  const a = order.shippingAddress;
  return (
    <p style={text}>
      {order.customerName}
      <br />
      {a.line1}
      {a.line2 ? (
        <>
          <br />
          {a.line2}
        </>
      ) : null}
      <br />
      {a.city}, {a.state ?? ""} {a.postalCode}
      <br />
      {a.country === "US" ? "United States" : a.country}
    </p>
  );
}

export function OrderConfirmationEmail({ order }: { order: EmailOrder }) {
  const hasCustom = order.items.some((item) => item.isCustom);
  return (
    <EmailLayout preview={t.confirmationPreview}>
      <h1 style={heading}>{t.greeting(firstName(order.customerName))}</h1>
      <p style={text}>{t.confirmationIntro}</p>
      <p style={{ ...text, fontWeight: 600 }}>
        {t.orderNumber}: {order.number}
      </p>
      <ItemsTable order={order} />
      <h2 style={{ ...heading, fontSize: "20px" }}>{t.nextTitle}</h2>
      <p style={text}>{t.nextReady}</p>
      {hasCustom ? <p style={text}>{t.nextCustom}</p> : null}
      <h2 style={{ ...heading, fontSize: "20px" }}>{t.shipTo}</h2>
      <Address order={order} />
      <p style={muted}>{t.questions}</p>
    </EmailLayout>
  );
}

export function AdminNewOrderEmail({ order }: { order: EmailOrder }) {
  const hasCustom = order.items.some((item) => item.isCustom);
  return (
    <EmailLayout preview={t.adminSubject(order.number, formatCents(order.totalCents))}>
      <h1 style={heading}>{t.adminSubject(order.number, formatCents(order.totalCents))}</h1>
      <p style={text}>{t.adminIntro}</p>
      {hasCustom ? (
        <p style={{ ...text, color: c.crimson700, fontWeight: 600 }}>{t.adminCustomFit}</p>
      ) : null}
      <ItemsTable order={order} />
      <p style={text}>{order.email}</p>
      <Address order={order} />
    </EmailLayout>
  );
}

export function RefundEmail({ order, amountCents }: { order: EmailOrder; amountCents: number }) {
  return (
    <EmailLayout preview={t.refundSubject(order.number)}>
      <h1 style={heading}>{t.refundSubject(order.number)}</h1>
      <p style={text}>{t.refundIntro(formatCents(amountCents))}</p>
      <p style={muted}>{t.questions}</p>
    </EmailLayout>
  );
}
