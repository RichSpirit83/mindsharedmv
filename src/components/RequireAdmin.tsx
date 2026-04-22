// Auth temporarily disabled — admin routes are open to everyone.
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
