import { ComingSoon } from "@/components/ComingSoon";
import { NavRail } from "@/components/layout/NavRail";
import { StoryIcon } from "@/components/ui/Icons";

export default function StoriesPage() {
  return (
    <div className="flex h-full bg-surface">
      <NavRail />
      <ComingSoon
        title="Stories"
        description="Disappearing photo and video updates are not part of this build."
        icon={<StoryIcon size={64} />}
      />
    </div>
  );
}
