"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SignalLogo } from "@/components/SignalLogo";
import { useSession } from "@/lib/store/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, restore } = useSession();

  useEffect(() => {
    if (status === "loading") void restore();
  }, [status, restore]);

  useEffect(() => {
    if (status === "anonymous") router.replace("/sign-in");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
        <SignalLogo size={44} className="animate-pulse text-line-strong" />
      </div>
    );
  }

  return <>{children}</>;
}
