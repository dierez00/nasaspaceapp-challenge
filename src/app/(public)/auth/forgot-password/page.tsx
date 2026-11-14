import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthShell } from "@/shared/ui/auth-shell";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Recuperación" title="Recupera tu acceso" description="Te enviaremos un enlace seguro para elegir una contraseña nueva.">
      <form action={requestPasswordReset} className="form-stack">
        <label>Correo<input autoComplete="email" name="email" required type="email" /></label>
        <FormMessage error={query.error} message={query.message} />
        <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
        <p className="form-footnote"><Link href="/auth/login">Volver al acceso</Link></p>
      </form>
    </AuthShell>
  );
}
