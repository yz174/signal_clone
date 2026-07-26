interface ComingSoonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface-raised px-6 text-center">
      <div className="text-line-strong">{icon}</div>
      <div>
        <p className="text-base font-medium text-body">{title}</p>
        <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>
      </div>
      <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-medium tracking-wide text-muted uppercase">
        Coming soon
      </span>
    </div>
  );
}
