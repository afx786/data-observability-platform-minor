export default function PageHeader({ title, description, actions, eyebrow, className = "" }) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div className="max-w-3xl">
        {eyebrow && <p className="stitch-eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-stitch-headline text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-[#0F172A]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#475569]">{description}</p>
        )}
        <div className="stitch-divider mt-5" />
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
