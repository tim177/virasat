"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { AlertCircleIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";
import {
  convertValue,
  MAX_NOTES_LENGTH,
  MEASUREMENT_FIELDS,
  MEASUREMENT_SECTIONS,
  MEASUREMENT_UNITS,
  rangeFor,
  validateMeasurements,
  valuesToTexts,
  type MeasurementField,
  type MeasurementKind,
  type MeasurementSet,
  type MeasurementUnit,
} from "@/lib/measurements";

import { MeasurementDiagram } from "./measurement-diagram";

const t = en.fit;

type Props = {
  kind: MeasurementKind;
  initial: MeasurementSet | null;
  submitLabel: string;
  /** Called with a checked set. Return an error message to keep the form open. */
  onSubmit: (set: MeasurementSet) => Promise<string | null | void> | string | null | void;
  onCancel?: () => void;
  /** Extra controls at the top (saved profiles) and before the buttons (save as profile). */
  top?: ReactNode;
  bottom?: ReactNode;
  /** Checks extra fields owned by the parent (e.g. a profile name) before submitting. */
  validateExtra?: () => boolean;
};

/**
 * The custom-fit measurement form: inch/cm switch, a "where to measure" diagram, sections of
 * measurements with help text, and range checks with an error summary. Works fully by keyboard.
 */
export function MeasurementForm({
  kind,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  top,
  bottom,
  validateExtra,
}: Props) {
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const fields = MEASUREMENT_FIELDS[kind];
  const [unit, setUnit] = useState<MeasurementUnit>(initial?.unit ?? "in");
  const [texts, setTexts] = useState<Record<string, string>>(
    initial && initial.kind === kind ? valuesToTexts(initial.values) : {},
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitted, setSubmitted] = useState(false);
  // The summary lists the problems found at the last submit (field errors update as you type).
  const [summaryKeys, setSummaryKeys] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const result = validateMeasurements(kind, unit, texts, notes);
  const errors = submitted && !result.ok ? result.errors : {};
  const allKeys = [...fields.map((f) => f.key), "notes"];
  const fieldId = (key: string) => `${formId}-${key}`;
  const numberOf = (key: string) => fields.findIndex((f) => f.key === key) + 1;

  function errorText(field: MeasurementField): string | undefined {
    const error = errors[field.key];
    if (!error) return undefined;
    if (error === "range") {
      const { min, max } = rangeFor(field, unit);
      return t.errors.range(min, max, t.unitShort[unit]);
    }
    return error === "required" ? t.errors.required : t.errors.number;
  }

  function changeUnit(next: MeasurementUnit) {
    if (next === unit) return;
    // Convert what's been typed, so switching units never loses work.
    setTexts((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, text]) => {
          const value = Number(text);
          return [
            key,
            text.trim() !== "" && Number.isFinite(value)
              ? String(convertValue(value, unit, next))
              : text,
          ];
        }),
      ),
    );
    setUnit(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setFormError(null);
    const extraOk = validateExtra ? validateExtra() : true;
    setSummaryKeys(result.ok ? [] : allKeys.filter((key) => key in result.errors));
    if (!result.ok) {
      // Move focus to the summary, which lists each problem with a link to its field.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (!extraOk) return;
    setBusy(true);
    const message = await onSubmit(result.set);
    setBusy(false);
    if (message) setFormError(message);
  }

  const unitShort = t.unitShort[unit];

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {summaryKeys.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="flex flex-col gap-2 rounded-card border border-error bg-white p-4 focus:outline-2 focus:outline-offset-2 focus:outline-(--focus-ring)"
        >
          <p className="flex items-start gap-2 font-medium text-error">
            <AlertCircleIcon className="mt-0.5 size-5 shrink-0" />
            {t.errorSummary(summaryKeys.length)}
          </p>
          <ul className="grid pl-7 text-body-sm sm:grid-cols-2 sm:gap-x-6 md:grid-cols-3">
            {summaryKeys.map((key) => {
              const field = fields.find((f) => f.key === key);
              const label = field ? `${numberOf(key)}. ${t.fields[kind][key]?.label}` : t.notes;
              return (
                <li key={key}>
                  <a
                    href={`#${fieldId(key)}`}
                    className="inline-flex min-h-11 items-center text-crimson-700 underline"
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(fieldId(key))?.focus();
                    }}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {top}

      <p className="text-body-sm text-stone-700">{t.intro}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-sm font-medium">{t.units}</legend>
        <div className="flex gap-2">
          {MEASUREMENT_UNITS.map((option) => (
            <label key={option} className="relative">
              <input
                type="radio"
                name={`${formId}-unit`}
                value={option}
                checked={unit === option}
                onChange={() => changeUnit(option)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center rounded-pill border border-stone-700 bg-white px-5 text-body-sm transition-colors duration-150 hover:bg-sand",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus-ring)",
                  "peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-white peer-checked:hover:bg-charcoal",
                )}
              >
                {t.unitNames[option]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 md:grid-cols-[13rem_1fr] md:gap-8">
        <figure className="flex flex-col items-center gap-2 self-start md:sticky md:top-0">
          <MeasurementDiagram kind={kind} activeKey={activeKey} className="max-w-40 md:max-w-56" />
          <figcaption className="text-caption text-stone-700">{t.diagramTitle}</figcaption>
        </figure>

        <div className="flex flex-col gap-8">
          {MEASUREMENT_SECTIONS.map((section) => {
            const sectionFields = fields.filter((f) => f.section === section);
            if (sectionFields.length === 0) return null;
            return (
              <fieldset key={section} className="flex flex-col gap-4">
                <legend className="mb-4 font-display text-body-lg font-medium">
                  {t.sections[section]}
                </legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  {sectionFields.map((field) => {
                    const strings = t.fields[kind][field.key];
                    return (
                      <Input
                        key={field.key}
                        id={fieldId(field.key)}
                        name={field.key}
                        label={t.fieldLabel(
                          numberOf(field.key),
                          strings?.label ?? field.key,
                          unitShort,
                        )}
                        help={strings?.help}
                        error={errorText(field)}
                        inputMode="decimal"
                        autoComplete="off"
                        value={texts[field.key] ?? ""}
                        onChange={(event) =>
                          setTexts((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        onFocus={() => setActiveKey(field.key)}
                        onBlur={() => setActiveKey((key) => (key === field.key ? null : key))}
                      />
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <Textarea
            id={fieldId("notes")}
            label={t.notes}
            help={t.notesHelp}
            optional
            maxLength={MAX_NOTES_LENGTH}
            error={errors.notes ? t.errors.notes : undefined}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      {bottom}

      {formError ? (
        <p role="alert" className="flex items-start gap-2 text-body-sm text-error">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            {t.cancel}
          </Button>
        ) : null}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
