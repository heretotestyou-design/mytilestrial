// Instant dark backdrop while a public page loads (matches the landing hero).
export default function Loading() {
  return <div aria-busy="true" aria-label="Loading" className="min-h-screen bg-ink" />;
}
