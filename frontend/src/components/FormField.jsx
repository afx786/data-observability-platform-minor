export default function FormField({ label, hint, htmlFor, children, className = "" }) {
  const Tag = htmlFor ? "label" : "div";

  return (
    <Tag htmlFor={htmlFor} className={`block text-sm font-medium text-slate-700 ${className}`}>
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    </Tag>
  );
}
