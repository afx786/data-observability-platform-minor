import { useEffect } from "react";

const SIZES = {
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export default function Modal({ open, onClose, title, description, children, footer, size = "lg" }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="stitch-modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F172A]/45 p-4 backdrop-blur-[6px] sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`stitch-modal w-full ${SIZES[size] ?? SIZES.lg} overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_24px_48px_-16px_rgba(15,23,42,0.28)]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] bg-[#FBFCFE] px-5 py-4">
          <div className="min-w-0">
            <p className="stitch-eyebrow mb-1">Detail inspector</p>
            <h2 className="font-stitch-headline text-[19px] font-semibold leading-snug text-[#0F172A]">
              {title}
            </h2>
            {description && (
              <p className="stitch-mono mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FBFCFE] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
