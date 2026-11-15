export default function PagePlaceholder({ title, description }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>

      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
        Not implemented yet.
      </div>
    </section>
  );
}
