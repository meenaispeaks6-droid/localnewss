const NewsSkeleton = ({ count = 6 }: { count?: number }) => (
  <div
    className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex gap-2">
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="mt-4 h-4 w-11/12 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-8/12 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-10/12 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-5 h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    ))}
  </div>
);

export default NewsSkeleton;
