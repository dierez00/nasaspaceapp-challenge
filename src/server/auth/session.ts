import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

export async function requireUser(returnTo: string) {
  const user = await getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}
