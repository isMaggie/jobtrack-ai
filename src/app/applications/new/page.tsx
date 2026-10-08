import Link from "next/link";
import { ApplicationForm } from "@/components/applications/application-form";

export default function NewApplicationPage() {
  return <main className="mx-auto max-w-2xl p-6">
    <Link className="text-blue-700 underline" href="/">Back to dashboard</Link>
    <h1 className="my-6 text-3xl font-semibold">Create application</h1>
    <ApplicationForm />
  </main>;
}
