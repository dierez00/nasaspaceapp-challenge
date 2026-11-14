"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/server/auth/server";
import { getFirstTenantForUser } from "@/server/tenants/queries";
import { messageUrl, safeRedirectPath } from "@/shared/lib/redirect";

const credentialsSchema = z.object({
  email: z.email("Escribe un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function login(formData: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  const next = safeRedirectPath(formData.get("next")?.toString(), "/onboarding");
  if (!parsed.success) redirect(messageUrl("/auth/login", "error", parsed.error.issues[0].message));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) redirect(messageUrl("/auth/login", "error", "Correo o contraseña incorrectos."));

  if (next !== "/onboarding") redirect(next);
  const membership = await getFirstTenantForUser(data.user.id);
  redirect(membership ? `/workspace/${membership.tenant.slug}` : "/onboarding");
}

export async function register(formData: FormData) {
  const parsed = credentialsSchema.extend({
    fullName: z.string().trim().min(2, "Escribe tu nombre."),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(messageUrl("/auth/register", "error", parsed.error.issues[0].message));

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });
  if (error) redirect(messageUrl("/auth/register", "error", error.message));
  redirect(messageUrl("/auth/login", "message", "Revisa tu correo para confirmar la cuenta."));
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = z.object({ email: z.email("Escribe un correo válido.") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(messageUrl("/auth/forgot-password", "error", parsed.error.issues[0].message));

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });
  if (error) redirect(messageUrl("/auth/forgot-password", "error", error.message));
  redirect(messageUrl("/auth/forgot-password", "message", "Si el correo existe, recibirás un enlace para continuar."));
}

export async function updatePassword(formData: FormData) {
  const parsed = z.object({ password: z.string().min(8, "Usa al menos 8 caracteres.") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(messageUrl("/auth/reset-password", "error", parsed.error.issues[0].message));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect(messageUrl("/auth/reset-password", "error", error.message));
  redirect(messageUrl("/auth/login", "message", "Contraseña actualizada. Ya puedes iniciar sesión."));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
