const accents = /[\u0300-\u036f]/g;

export function toTenantSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(accents, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const tenantSlugPattern = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/;
