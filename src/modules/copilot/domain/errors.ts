import type { Locale } from "@/shared/i18n/locale";

/** Error whose message is already safe and actionable to show to the user. */
export class CopilotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CopilotError";
  }
}

export function messageForStatus(status: number, locale: Locale = "en") {
  const en = locale === "en";
  if (status === 429)
    return en
      ? "There are too many queries right now. Wait a few seconds and try again."
      : "Hay demasiadas consultas en este momento. Espera unos segundos e inténtalo de nuevo.";
  if (status === 400 || status === 413 || status === 422)
    return en
      ? "We couldn't process the query. Rephrase it with less text and try again."
      : "No pudimos procesar la consulta. Reformúlala con menos texto e inténtalo de nuevo.";
  if (status === 401 || status === 403)
    return en
      ? "You don't have access to the copilot. Reload the page and try again."
      : "No tienes acceso al copiloto. Recarga la página e inténtalo de nuevo.";
  return en
    ? "The copilot is unavailable. Try again."
    : "El copiloto no está disponible. Inténtalo de nuevo.";
}

/** Maps any thrown value to a user-facing message, never leaking raw technical text. */
export function describeCopilotError(error: unknown, locale: Locale = "en") {
  if (error instanceof CopilotError) return error.message;
  if (error instanceof TypeError)
    return locale === "en"
      ? "No connection to the copilot. Check your network and try again."
      : "No hay conexión con el copiloto. Revisa tu red e inténtalo de nuevo.";
  return locale === "en"
    ? "The copilot's answer arrived incomplete. Try again."
    : "La respuesta del copiloto llegó incompleta. Inténtalo de nuevo.";
}
