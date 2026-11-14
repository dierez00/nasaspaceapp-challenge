import Link from "next/link";
import { login } from "@/app/actions/auth";
import { AuthShell } from "@/shared/ui/auth-shell";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Acceso" title="Continúa donde lo dejaste" description="Entra al espacio privado de tu equipo y retoma el trabajo pendiente.">
      <form action={login} className="form-stack">
        <input name="next" type="hidden" value={query.next ?? "/onboarding"} />
        <label>Correo<input autoComplete="email" name="email" required type="email" /></label>
        <label>Contraseña<input autoComplete="current-password" minLength={8} name="password" required type="password" /></label>
        <FormMessage error={query.error} message={query.message} />
        <SubmitButton pendingText="Ingresando…">Ingresar</SubmitButton>
        <div className="form-links"><Link href="/auth/forgot-password">Olvidé mi contraseña</Link><Link href="/auth/register">Crear cuenta</Link></div>
      </form>
    </AuthShell>
  );
}
