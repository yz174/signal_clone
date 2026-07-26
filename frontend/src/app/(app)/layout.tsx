"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SignalLogo } from "@/components/SignalLogo";
import { Toaster } from "@/components/ui/Toaster";
import { useSession } from "@/lib/store/session";
import { useRealtime } from "@/lib/ws/useRealtime";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, restore } = useSession();

  useRealtime();

  useEffect(() => {
    if (status === "loading") void restore();
  }, [status, restore]);

  useEffect(() => {
    if (status === "anonymous") router.replace("/sign-in");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="bg-surface flex h-full items-center justify-center">
        <SignalLogo size={44} className="text-line-strong animate-pulse" />
      </div>
    );
  }

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
