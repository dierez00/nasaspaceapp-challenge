/** Error whose message is already safe and actionable to show to the user. */
export class CopilotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CopilotError";
  }
}

export function messageForStatus(status: number) {
  if (status === 429)
    return "Hay demasiadas consultas en este momento. Espera unos segundos e inténtalo de nuevo.";
  if (status === 400 || status === 413 || status === 422)
    return "No pudimos procesar la consulta. Reformúlala con menos texto e inténtalo de nuevo.";
  if (status === 401 || status === 403)
    return "No tienes acceso al copiloto. Recarga la página e inténtalo de nuevo.";
  return "El copiloto no está disponible. Inténtalo de nuevo.";
}

/** Maps any thrown value to a user-facing message, never leaking raw technical text. */
export function describeCopilotError(error: unknown) {
  if (error instanceof CopilotError) return error.message;
  if (error instanceof TypeError)
    return "No hay conexión con el copiloto. Revisa tu red e inténtalo de nuevo.";
  return "La respuesta del copiloto llegó incompleta. Inténtalo de nuevo.";
}
