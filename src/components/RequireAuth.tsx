// Auth temporarily disabled — all routes are open.
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
