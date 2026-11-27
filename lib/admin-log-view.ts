import { courierName } from "@/lib/couriers";
import { en } from "@/lib/i18n/en";
import { formatCents } from "@/lib/money";

// Turns admin_log's before/after snapshots into short lines for the admin log page:
// "Status: Paid → Confirmed". Pure, so it is unit-tested.

const t = en.admin.log;

/** Fields shown for a new record (with no "before"), instead of every field. */
const SUMMARY_FIELDS = ["title", "priceCents", "status", "note"];

export type FieldChange = { field: string; label: string; before: string; after: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function statusLabel(value: string): string {
  const order = en.orderStatus as Record<string, string>;
  const product = en.productStatus as Record<string, string>;
  return order[value] ?? product[value] ?? value;
}

function sizeText(row: unknown): string {
  if (!isRecord(row)) return String(row);
  const stock = row.stock === null || row.stock === undefined ? t.madeToOrder : String(row.stock);
  return `${String(row.size)}: ${stock}`;
}

/**
 * "compareAtCents" → "Compare at cents", for fields without a label. Names that already read as
 * words ("6. Waist", logged for measurement changes) stay as they are.
 */
function humanize(field: string): string {
  if (/\s/.test(field)) return field;
  const words = field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function fieldLabel(field: string): string {
  return t.fields[field] ?? humanize(field);
}

export function actionLabel(action: string): string {
  return t.actions[action] ?? action;
}

/** A logged value as short text: money as dollars, statuses as their names, lists summed up. */
export function formatLogValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t.yes : t.no;
  if (typeof value === "number" && field.endsWith("Cents") && Number.isSafeInteger(value)) {
    return formatCents(value);
  }
  if (field === "status" && typeof value === "string") return statusLabel(value);
  if (field === "courier" && typeof value === "string") return courierName(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (field === "sizes") return value.map(sizeText).join(", ");
    if (field === "photos") return t.photos(value.length);
    return value.map(String).join(", ");
  }
  if (isRecord(value)) return JSON.stringify(value);
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/** What differs between before and after. A new record lists its key fields only. */
export function describeChanges(before: unknown, after: unknown): FieldChange[] {
  const previous = isRecord(before) ? before : null;
  const next = isRecord(after) ? after : {};
  const fields = previous
    ? [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    : Object.keys(next).filter((field) => SUMMARY_FIELDS.includes(field));
  return fields
    .filter((field) => !previous || JSON.stringify(previous[field]) !== JSON.stringify(next[field]))
    .map((field) => ({
      field,
      label: fieldLabel(field),
      before: previous ? formatLogValue(field, previous[field]) : "—",
      after: formatLogValue(field, next[field]),
    }));
}
