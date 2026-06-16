import Link from "next/link";
import { Briefcase, Mail } from "lucide-react";

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <Briefcase className="h-8 w-8 text-blue-400" />
          <span className="text-2xl font-bold text-white">Rotahr</span>
        </Link>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8">
          <div className="h-16 w-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-3">Check your email</h1>
          <p className="text-slate-400 text-sm">
            A sign-in link has been sent to your email address. Click the link to
            access your Rotahr account.
          </p>
          <p className="text-slate-500 text-xs mt-4">
            Didn&apos;t receive it? Check your spam folder.
          </p>
          <Link
            href="/auth/signin"
            className="block mt-6 text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
