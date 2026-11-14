"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { createClient } from "@/server/auth/server";
import { messageUrl } from "@/shared/lib/redirect";
import { tenantSlugPattern, toTenantSlug } from "@/shared/lib/slug";

const tenantSchema = z.object({
  name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres.").max(80),
  slug: z.string().trim().max(48).optional(),
});

export async function createTenant(formData: FormData) {
  await requireUser("/onboarding");
  const parsed = tenantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(messageUrl("/onboarding", "error", parsed.error.issues[0].message));

  const slug = toTenantSlug(parsed.data.slug || parsed.data.name);
  if (!tenantSlugPattern.test(slug)) {
    redirect(messageUrl("/onboarding", "error", "El identificador debe tener entre 3 y 48 caracteres."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant", {
    tenant_name: parsed.data.name,
    tenant_slug: slug,
  });
  if (error) {
    const message = error.code === "23505" ? "Ese identificador ya está en uso." : "No fue posible crear la organización.";
    redirect(messageUrl("/onboarding", "error", message));
  }
  redirect(`/workspace/${slug}`);
}
