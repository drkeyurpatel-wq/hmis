// app/(dashboard)/lab/loading.tsx
export default function LabLoading() {
  return (
    <div className="max-w-[1400px] mx-auto animate-h1-shimmer">
      <div className="h-12 bg-h1-navy/5 rounded-h1 mb-4" />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-h1-navy/5 rounded-h1" />
        ))}
      </div>
      <div className="h-8 bg-h1-navy/5 rounded-h1 mb-4 w-3/4" />
      <div className="h-64 bg-h1-navy/5 rounded-h1" />
    </div>
  );
}
