import Link from "next/link";
import { EmailImportForm } from "@/components/applications/email-import-form";

export default function ImportApplicationPage() {
  return <main className="mx-auto max-w-2xl p-6">
    <Link href="/" className="text-blue-700 underline">Back to dashboard</Link>
    <h1 className="my-6 text-3xl font-semibold">Import from confirmation email</h1>
    <EmailImportForm />
  </main>;
}
