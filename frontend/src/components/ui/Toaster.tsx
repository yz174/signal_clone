"use client";

import { useToasts } from "@/lib/store/toast";

export function Toaster() {
  const { toasts, dismiss } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className={`pointer-events-auto max-w-sm rounded-full px-4 py-2.5 text-sm shadow-lg transition ${
            toast.tone === "error" ? "bg-[#be0404] text-white" : "bg-gray-85 text-white"
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
