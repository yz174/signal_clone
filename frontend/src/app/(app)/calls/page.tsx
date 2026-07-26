import { ComingSoon } from "@/components/ComingSoon";
import { NavRail } from "@/components/layout/NavRail";
import { PhoneIcon } from "@/components/ui/Icons";

export default function CallsPage() {
  return (
    <div className="bg-surface flex h-full">
      <NavRail />
      <ComingSoon
        title="Calls"
        description="Voice and video calling are not part of this build."
        icon={<PhoneIcon size={64} />}
      />
    </div>
  );
}
