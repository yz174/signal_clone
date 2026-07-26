import { CheckIcon, ClockIcon, DoubleCheckIcon } from "@/components/ui/Icons";
import type { MessageStatus } from "@/lib/api/types";

const LABELS: Record<MessageStatus, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed to send",
};

function iconFor(status: MessageStatus) {
  switch (status) {
    case "sending":
      return <ClockIcon size={13} className="opacity-70" />;
    case "failed":
      return <span className="text-[11px] font-semibold">!</span>;
    case "sent":
      return <CheckIcon size={14} className="opacity-70" />;
    default:
      return (
        <DoubleCheckIcon size={16} className={status === "read" ? "" : "opacity-70"} />
      );
  }
}

export function ReceiptTicks({ status }: { status: MessageStatus }) {
  return (
    <span role="img" aria-label={LABELS[status]} className="inline-flex items-center">
      {iconFor(status)}
    </span>
  );
}
