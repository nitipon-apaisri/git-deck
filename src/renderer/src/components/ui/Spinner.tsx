export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span
      className="inline-block size-(--icon-size-sm) flex-none animate-spin rounded-full border-2 border-border border-t-(--accent) motion-reduce:animate-none motion-reduce:border-r-(--accent)"
      role="status"
      aria-label={label}
      title={label}
    />
  )
}
