import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-ivory-100 p-5">
      <div className="card w-full max-w-md rounded-3xl p-7 sm:p-9">
        <Logo href="/landing" className="mb-8" />
        <Suspense><AuthForm mode="login" adminOnly /></Suspense>
      </div>
    </main>
  );
}
