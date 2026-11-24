"use client";

import { useId, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { AlertCircleIcon } from "./icons";

function ErrorText({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-body-sm text-error">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
  error?: string;
};

/** A checkbox whose whole row (at least 44px tall) is clickable. */
export function Checkbox({ label, description, error, id, className, ...rest }: CheckboxProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={fieldId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
        <input
          {...rest}
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-crimson-700"
        />
        <span className="text-body">
          {label}
          {description ? (
            <span className="block text-body-sm text-stone-700">{description}</span>
          ) : null}
        </span>
      </label>
      {error ? <ErrorText id={errorId}>{error}</ErrorText> : null}
    </div>
  );
}

export type RadioOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type RadioGroupProps = {
  legend: string;
  name: string;
  options: RadioOption[];
  /** Controlled value. Leave out and use `defaultValue` for an uncontrolled group. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  help?: string;
  error?: string;
  required?: boolean;
  className?: string;
};

/** A group of radio buttons with a visible legend. Arrow keys move between options. */
export function RadioGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onChange,
  help,
  error,
  required,
  className,
}: RadioGroupProps) {
  const groupId = useId();
  const legendId = `${groupId}-legend`;
  const helpId = `${groupId}-help`;
  const errorId = `${groupId}-error`;
  const describedBy = [help && helpId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    // role="radiogroup" is where aria-invalid is allowed (it isn't on individual radios).
    <fieldset
      role="radiogroup"
      aria-labelledby={legendId}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <legend id={legendId} className="text-body-sm font-medium text-charcoal">
        {legend}
      </legend>
      {help ? (
        <p id={helpId} className="text-body-sm text-stone-700">
          {help}
        </p>
      ) : null}
      {error ? <ErrorText id={errorId}>{error}</ErrorText> : null}
      <div className="flex flex-col">
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex min-h-11 items-start gap-3 py-2.5",
                option.disabled ? "cursor-not-allowed text-stone-700" : "cursor-pointer",
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={value === undefined ? undefined : value === option.value}
                defaultChecked={value === undefined ? defaultValue === option.value : undefined}
                onChange={() => onChange?.(option.value)}
                disabled={option.disabled}
                required={required}
                className="mt-0.5 size-5 shrink-0 cursor-pointer accent-crimson-700"
              />
              <span className="text-body">
                {option.label}
                {option.description ? (
                  <span className="block text-body-sm text-stone-700">{option.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
