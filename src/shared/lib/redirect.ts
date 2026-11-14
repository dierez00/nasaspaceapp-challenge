export function safeRedirectPath(value: string | null | undefined, fallback = "/") {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function messageUrl(path: string, kind: "error" | "message", message: string) {
  const params = new URLSearchParams({ [kind]: message });
  return `${path}?${params.toString()}`;
}
