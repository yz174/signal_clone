import { CheckIcon, ClockIcon, DoubleCheckIcon } from "@/components/ui/Icons";
import type { MessageStatus } from "@/lib/api/types";

const LABELS: Record<MessageStatus, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed to send",
};

export function ReceiptTicks({ status }: { status: MessageStatus }) {
  const label = LABELS[status];

  if (status === "sending") {
    return <ClockIcon size={13} className="opacity-70" aria-label={label} />;
  }

  if (status === "failed") {
    return (
      <span className="text-[11px] font-medium" role="img" aria-label={label}>
        !
      </span>
    );
  }

  if (status === "sent") {
    return <CheckIcon size={14} className="opacity-70" aria-label={label} />;
  }

  return (
    <DoubleCheckIcon
      size={16}
      className={status === "read" ? "text-white" : "opacity-70"}
      aria-label={label}
    />
  );
}
