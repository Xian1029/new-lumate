export default function CourseLoading() {
  return (
    <div className="min-h-screen bg-background" role="status" aria-label="正在打开学习空间">
      <div className="h-12 border-b border-border/70 bg-card" />
      <div className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        <div className="h-16 animate-pulse rounded-2xl bg-muted/50" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-muted/50" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted/50" />
        </div>
      </div>
      <span className="sr-only">正在打开学习空间…</span>
    </div>
  );
}
