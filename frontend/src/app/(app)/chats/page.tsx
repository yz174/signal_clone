import { SignalLogo } from "@/components/SignalLogo";

export default function NoConversationSelected() {
  return (
    <div className="bg-surface-raised flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <SignalLogo size={64} className="text-line-strong" />
      <div>
        <p className="text-body text-base font-medium">Select a chat</p>
        <p className="text-muted mt-1 max-w-xs text-sm">
          Pick a conversation from the list, or start a new one.
        </p>
      </div>
    </div>
  );
}
