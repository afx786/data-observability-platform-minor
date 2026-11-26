export default function SectionCard({
  title,
  description,
  actions,
  children,
  eyebrow,
  className = "",
}) {
  const hasHeader = Boolean(title || description || actions || eyebrow);

  return (
    <section className={`stitch-card stitch-card-hover stitch-glow p-5 ${className}`}>
      {hasHeader && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="stitch-eyebrow mb-1">{eyebrow}</p>}
            {title && (
              <h2 className="font-stitch-headline text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[#0F172A]">
                {title}
              </h2>
            )}
            {description && (
              <p className="stitch-mono mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
