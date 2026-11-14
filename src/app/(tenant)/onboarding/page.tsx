import { redirect } from "next/navigation";
import { createTenant } from "@/app/actions/tenants";
import { requireUser } from "@/server/auth/session";
import { getFirstTenantForUser } from "@/server/tenants/queries";
import { AuthShell } from "@/shared/ui/auth-shell";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("/onboarding");
  const existing = await getFirstTenantForUser(user.id);
  if (existing) redirect(`/workspace/${existing.tenant.slug}`);
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Primer espacio" title="Dale nombre a tu organización" description="Este será el espacio privado desde el que tu equipo empezará a trabajar.">
      <form action={createTenant} className="form-stack">
        <label>Nombre de la organización<input autoComplete="organization" name="name" placeholder="Acme Studio" required /></label>
        <label>Identificador de URL <span>(opcional)</span><input name="slug" pattern="[a-z0-9-]+" placeholder="acme-studio" /></label>
        <FormMessage error={query.error} />
        <SubmitButton pendingText="Creando espacio…">Crear organización</SubmitButton>
      </form>
    </AuthShell>
  );
}
