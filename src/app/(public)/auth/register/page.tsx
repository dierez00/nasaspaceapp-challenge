import Link from "next/link";
import { register } from "@/app/actions/auth";
import { AuthShell } from "@/shared/ui/auth-shell";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Nueva cuenta" title="Empieza por tu nombre" description="Después de confirmar tu correo podrás crear el espacio de tu organización.">
      <form action={register} className="form-stack">
        <label>Nombre completo<input autoComplete="name" name="fullName" required /></label>
        <label>Correo<input autoComplete="email" name="email" required type="email" /></label>
        <label>Contraseña<input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
        <FormMessage error={query.error} />
        <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
        <p className="form-footnote">¿Ya tienes cuenta? <Link href="/auth/login">Ingresa aquí</Link>.</p>
      </form>
    </AuthShell>
  );
}
