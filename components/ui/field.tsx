"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";

import { AlertCircleIcon, ChevronDownIcon } from "./icons";

type FieldBaseProps = {
  label: string;
  /** Short hint shown under the label, e.g. "Measure around the fullest part". */
  help?: string;
  /** Error message. Turns the field red and is read out by screen readers. */
  error?: string;
  /** Shows "(optional)" after the label. Mark optional fields, not required ones. */
  optional?: boolean;
};

const control =
  "w-full rounded-field border bg-white px-3 text-body text-charcoal transition-colors duration-150 placeholder:text-stone-700 disabled:cursor-not-allowed disabled:bg-sand";

function useFieldIds(id: string | undefined) {
  const generated = useId();
  const fieldId = id ?? generated;
  return { fieldId, helpId: `${fieldId}-help`, errorId: `${fieldId}-error` };
}

function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

function FieldShell({
  fieldId,
  helpId,
  errorId,
  label,
  help,
  error,
  optional,
  className,
  children,
}: FieldBaseProps & {
  fieldId: string;
  helpId: string;
  errorId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-body-sm font-medium text-charcoal">
        {label}
        {optional ? <span className="font-normal text-stone-700"> {en.ui.optional}</span> : null}
      </label>
      {help ? (
        <p id={helpId} className="text-body-sm text-stone-700">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-body-sm text-error">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {children}
    </div>
  );
}

type InputProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, help, error, optional, id, className, ...rest }: InputProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell
      {...ids}
      label={label}
      help={help}
      error={error}
      optional={optional}
      className={className}
    >
      <input
        {...rest}
        id={ids.fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(help && ids.helpId, error && ids.errorId)}
        className={cn(control, "min-h-11", error ? "border-error" : "border-stone-700")}
      />
    </FieldShell>
  );
}

type TextareaProps = FieldBaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ label, help, error, optional, id, className, ...rest }: TextareaProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell
      {...ids}
      label={label}
      help={help}
      error={error}
      optional={optional}
      className={className}
    >
      <textarea
        {...rest}
        id={ids.fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(help && ids.helpId, error && ids.errorId)}
        className={cn(control, "min-h-28 py-2", error ? "border-error" : "border-stone-700")}
      />
    </FieldShell>
  );
}

export type SelectOption = { value: string; label: string };

type SelectProps = FieldBaseProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: SelectOption[];
    /** Shown as the first, empty choice, e.g. "Choose a size". */
    placeholder?: string;
  };

export function Select({
  label,
  help,
  error,
  optional,
  id,
  className,
  options,
  placeholder,
  ...rest
}: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell
      {...ids}
      label={label}
      help={help}
      error={error}
      optional={optional}
      className={className}
    >
      <div className="relative">
        <select
          {...rest}
          id={ids.fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(help && ids.helpId, error && ids.errorId)}
          className={cn(
            control,
            "min-h-11 appearance-none pr-10",
            error ? "border-error" : "border-stone-700",
          )}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-stone-700" />
      </div>
    </FieldShell>
  );
}
