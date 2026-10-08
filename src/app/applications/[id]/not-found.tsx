import Link from "next/link";

export default function ApplicationNotFound() {
  return <main className="mx-auto max-w-3xl p-6">
    <h1 className="mb-4 text-2xl font-semibold">Application not found</h1>
    <Link className="text-blue-700 underline" href="/">Back to dashboard</Link>
  </main>;
}
