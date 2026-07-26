import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:brightness-110 disabled:opacity-50",
  secondary:
    "bg-surface-raised text-body hover:bg-hover border border-line disabled:opacity-50",
  ghost: "text-body hover:bg-hover disabled:opacity-50",
  danger: "bg-[#be0404] text-white hover:brightness-110 disabled:opacity-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed ${
        VARIANTS[variant]
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}
