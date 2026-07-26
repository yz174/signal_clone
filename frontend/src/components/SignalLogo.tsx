export function SignalLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 1.5c-5.8 0-10.5 4.3-10.5 9.6 0 2.7 1.2 5.2 3.2 6.9l-.8 3.5a.6.6 0 0 0 .85.67l3.4-1.6c1.2.4 2.5.6 3.85.6 5.8 0 10.5-4.3 10.5-9.6S17.8 1.5 12 1.5Z" />
    </svg>
  );
}
