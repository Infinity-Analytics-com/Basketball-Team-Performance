export function LoadingCard({ label = "Loading" }: { label?: string }) {
  return (
    <div className="panel loading-card" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span className="skeleton-title">{label}</span>
    </div>
  );
}
