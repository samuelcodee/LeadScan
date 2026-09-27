import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/app-shell/logo";
import { getCurrentUser, safeNext } from "@/lib/auth/session";
import { googleEnabled } from "@/lib/auth/google";
import { isDemoMode } from "@/lib/env";
import { loginChannels } from "@/lib/messaging";

export const metadata: Metadata = { title: "Entrar ou criar conta" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, erro, criar } = await props.searchParams;
  const signup = criar === "1";
  const target = safeNext(next);
  const user = await getCurrentUser();
  if (user) redirect(user.onboardedAt ? target : `/onboarding?next=${encodeURIComponent(target)}`);

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex min-w-0 flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="w-fit" aria-label="LeadScan — página inicial">
          <Logo boxed />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-bold tracking-tight">{signup ? "Criar sua conta" : "Entrar ou criar conta"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {signup
              ? "Use o Google, seu e-mail ou celular. A conta nasce quando você confirma o código, sem senha pra decorar."
              : "Primeira vez? A conta é criada quando você confirma o código. Sem senha pra decorar."}
          </p>
          <div className="mt-8">
            <LoginForm
              next={target}
              googleEnabled={googleEnabled()}
              channels={loginChannels()}
              demoEnabled={isDemoMode()}
              error={typeof erro === "string" ? erro : undefined}
            />
          </div>
          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            Ao continuar você concorda com os{" "}
            <Link href="/termos" className="underline underline-offset-4 hover:text-foreground">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="underline underline-offset-4 hover:text-foreground">
              Política de privacidade
            </Link>
            .
          </p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-ink text-white lg:block">
        {/* luz lima no canto: a única "fonte de luz" da área escura */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rotate-12 bg-lime/90 [clip-path:polygon(40%_0,100%_0,100%_60%)]" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo tagline className="text-white" />
          <div className="max-w-md">
            <p className="text-4xl font-bold leading-[1.1] tracking-tight">
              Encontre os clientes certos. Crie o site ideal. <span className="text-lime">Venda mais.</span>
            </p>
            <ul className="mt-10 grid gap-4 text-sm text-white/75">
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden /> Busca por cidade e segmento em todo o Brasil, com o motivo de cada lead valer a pena.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden /> Protótipo do site com a cara do cliente em segundos, antes da primeira conversa.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden /> Link de pagamento com Pix ou cartão. A venda entra no seu financeiro na hora.
              </li>
            </ul>
          </div>
          <p className="text-xs text-white/50">Ranking semanal da comunidade reinicia toda segunda às 00:00 (horário de Brasília).</p>
        </div>
      </aside>
    </main>
  );
}
