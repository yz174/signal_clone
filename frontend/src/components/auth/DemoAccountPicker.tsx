"use client";

import { Avatar } from "@/components/ui/Avatar";
import { DEMO_ACCOUNTS, formatPhone } from "@/lib/demo-accounts";

interface DemoAccountPickerProps {
  selected: string;
  onSelect: (phone: string) => void;
}

export function DemoAccountPicker({ selected, onSelect }: DemoAccountPickerProps) {
  return (
    <section aria-labelledby="demo-accounts-heading">
      <div className="mb-3 flex items-center gap-3">
        <span aria-hidden className="bg-line h-px flex-1" />
        <h2 id="demo-accounts-heading" className="text-faint text-xs font-medium tracking-wide">
          or sign in as
        </h2>
        <span aria-hidden className="bg-line h-px flex-1" />
      </div>

      <ul className="border-line scrollbar-slim max-h-[15.5rem] overflow-y-auto rounded-xl border">
        {DEMO_ACCOUNTS.map((account) => {
          const active = account.phone === selected;
          return (
            <li key={account.phone} className="border-line border-b last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(account.phone)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 ease-out ${
                  active ? "bg-selected" : "hover:bg-hover"
                }`}
              >
                <Avatar name={account.name} color={account.color} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="text-body block truncate text-sm font-medium">
                    {account.name}
                  </span>
                  <span className="text-muted block truncate text-xs tabular-nums">
                    {formatPhone(account.phone)}
                  </span>
                </span>
                {active && (
                  <span className="text-accent text-xs font-medium" aria-label="Selected">
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-faint mt-2.5 text-xs">
        Ten seeded people, already talking to each other. Open two in separate browser profiles to
        see realtime.
      </p>
    </section>
  );
}
