import type { Metadata } from "next";

import { AdminLoginForm } from "@/components/admin/login-form";
import { ZariRule } from "@/components/ui/ornament";
import { en } from "@/lib/i18n/en";

const t = en.admin.login;

export const metadata: Metadata = { title: t.metaTitle };

export default function AdminLoginPage() {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-card border border-line bg-white p-6 shadow-raised sm:p-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="font-display text-h3">{en.site.name}</p>
          <ZariRule className="w-24" />
          <h1 className="font-display text-h2">{t.title}</h1>
          <p className="text-body-sm text-stone-700">{t.intro}</p>
        </header>
        <AdminLoginForm />
      </div>
    </main>
  );
}
