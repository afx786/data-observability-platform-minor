/** Small editorial brand mark with a single Bungee accent letter. */
export default function StitchIcon({ className = "" }) {
  return (
    <span
      className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-[#0F172A] shadow-[0_2px_6px_-2px_rgba(15,23,42,0.5)] ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8" focusable="false">
        <path
          d="M6 21.5 12 14l4.2 4.6L25.5 8"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25.5" cy="8" r="2.4" fill="#DFD4BE" />
        <path d="M6 25.5h20" stroke="#FFFFFF" strokeOpacity="0.32" strokeWidth="1" />
      </svg>
      <span
        className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-white/80 bg-[#8C6D23] text-[7px] leading-none text-white"
        style={{ fontFamily: '"Bungee", "Inter", sans-serif' }}
      >
        S
      </span>
    </span>
  );
}
