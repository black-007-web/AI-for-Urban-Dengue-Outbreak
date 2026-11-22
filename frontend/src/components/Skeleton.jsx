export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function CardSkeleton({ height = 220, label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="glass rounded-2xl p-5 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}
