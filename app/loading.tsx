/* The shape of the page while a route loads, not a spinner. Pulse only when
   the visitor has not asked for less motion. */
export default function Loading() {
  const block = "rounded-[28px] bg-muted motion-safe:animate-pulse"

  return (
    <main className="min-h-screen bg-outer p-4 sm:p-8" aria-busy="true">
      <div className="mx-auto max-w-5xl space-y-3 rounded-[34px] bg-canvas p-6 sm:p-8">
        <div className="h-8 w-56 rounded-full bg-muted motion-safe:animate-pulse" />
        <div className="h-3.5 w-40 rounded-full bg-muted motion-safe:animate-pulse" />
        <div className="grid grid-cols-2 gap-3 pt-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} h-32`} />
          ))}
        </div>
        <div className={`${block} h-56`} />
      </div>
    </main>
  )
}
