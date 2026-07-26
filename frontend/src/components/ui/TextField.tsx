import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, className = "", ...props }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <input
        className={`h-12 w-full rounded-lg border bg-surface px-4 text-base text-body transition outline-none placeholder:text-faint focus:border-accent ${
          error ? "border-[#be0404]" : "border-line-strong"
        } ${className}`}
        {...props}
      />
      {error ? (
        <span className="mt-1.5 block text-sm text-[#be0404]">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
