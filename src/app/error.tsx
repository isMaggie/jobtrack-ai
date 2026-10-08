"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl p-6">
    <h1 className="mb-4 text-2xl font-semibold">Couldn’t load this page</h1>
    <p>Please try again.</p>
    <button className="mt-4 rounded bg-blue-700 px-4 py-2 text-white" onClick={() => reset()}>Try again</button>
  </main>;
}
