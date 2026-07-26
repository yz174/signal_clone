interface ComingSoonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <div className="bg-surface-raised flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-line-strong">{icon}</div>
      <div>
        <p className="text-body text-base font-medium">{title}</p>
        <p className="text-muted mt-1 max-w-xs text-sm">{description}</p>
      </div>
      <span className="bg-surface-sunken text-muted rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
        Coming soon
      </span>
    </div>
  );
}
