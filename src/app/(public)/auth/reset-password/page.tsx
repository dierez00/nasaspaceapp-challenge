import { updatePassword } from "@/app/actions/auth";
import { AuthShell } from "@/shared/ui/auth-shell";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Seguridad" title="Elige una contraseña nueva" description="Usa al menos ocho caracteres y evita reutilizar una contraseña anterior.">
      <form action={updatePassword} className="form-stack">
        <label>Nueva contraseña<input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
        <FormMessage error={query.error} />
        <SubmitButton pendingText="Actualizando…">Guardar contraseña</SubmitButton>
      </form>
    </AuthShell>
  );
}
