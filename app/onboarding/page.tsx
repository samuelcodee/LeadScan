import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app-shell/logo";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { requireUser, safeNext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Complete seu cadastro" };

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const user = await requireUser({ allowIncomplete: true });
  const { next } = await props.searchParams;
  const target = safeNext(next);
  if (user.onboardedAt) redirect(target);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <Logo boxed />
      <div className="flex flex-1 flex-col justify-center py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Falta pouco</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu nome e seu @ aparecem para a comunidade. O resto você ajusta depois.
        </p>
        <div className="mt-8">
          <OnboardingForm initial={{ name: user.name, username: user.username ?? "", agencyName: user.agencyName ?? "" }} next={target} />
        </div>
      </div>
    </main>
  );
}
