"use client";

import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="border-line bg-surface flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-line flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-body text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:bg-hover hover:text-body flex h-8 w-8 items-center justify-center rounded-full transition"
          >
            ✕
          </button>
        </header>

        <div className="scrollbar-slim flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="border-line border-t px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
