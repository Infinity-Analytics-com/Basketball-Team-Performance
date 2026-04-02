export function LoadingCard({ label = "Loading" }: { label?: string }) {
  return (
    <div className="panel loading-card">
      <span className="skeleton-title">{label}</span>
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
  );
}
