import { SignalLogo } from "@/components/SignalLogo";

export default function OfflinePage() {
  return (
    <main className="bg-surface flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <SignalLogo size={56} className="text-line-strong" />
      <div>
        <p className="text-body text-base font-medium">You are offline</p>
        <p className="text-muted mt-1 max-w-xs text-sm">
          Messages you send are queued and will go out as soon as you reconnect.
        </p>
      </div>
    </main>
  );
}
