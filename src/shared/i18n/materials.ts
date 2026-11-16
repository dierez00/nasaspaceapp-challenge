import type { Locale, Text } from "./locale";

/**
 * Display names for catalog materials. Catalog values are English (NASA PSI
 * and the demo samples); the value itself stays the key for filters and
 * queries. Older Spanish keys are kept so stored scenarios still read well.
 */
const names: Record<string, Text> = {
  Cotton: { en: "Cotton", es: "Algodón" },
  Cellulose: { en: "Cellulose", es: "Celulosa" },
  Polyethylene: { en: "Polyethylene", es: "Polietileno" },
  Algodón: { en: "Cotton", es: "Algodón" },
  Celulosa: { en: "Cellulose", es: "Celulosa" },
  Polietileno: { en: "Polyethylene", es: "Polietileno" },
};

export function materialName(material: string, locale: Locale) {
  return names[material]?.[locale] ?? material;
}
