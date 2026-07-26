import { SignalLogo } from "@/components/SignalLogo";

export default function NoConversationSelected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface-raised px-6 text-center">
      <SignalLogo size={64} className="text-line-strong" />
      <div>
        <p className="text-base font-medium text-body">Select a chat</p>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Pick a conversation from the list, or start a new one.
        </p>
      </div>
    </div>
  );
}
