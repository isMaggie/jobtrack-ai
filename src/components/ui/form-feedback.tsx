export function FormFeedback({ message, error = false, id }: { message?: string; error?: boolean; id?: string }) {
  return <div id={id} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
    {message && <p className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{message}</p>}
  </div>;
}
