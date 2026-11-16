import { z } from "zod";
import { sourceSchema } from "@/modules/atlas/domain/experiment";
import {
  briefGravitySchema,
  cellSchema,
  evidenceBriefSchema,
  progressSteps,
} from "./brief";

export const querySchema = z
  .object({
    version: z.literal(1),
    queryId: z.string().min(1).max(100),
    text: z.string().trim().min(1).max(2000),
    context: z
      .object({
        pressure: z.number().min(0).max(16),
        oxygen: z.number().min(18).max(50),
        gravity: z.literal("lunar"),
      })
      .strict()
      .optional(),
    /** Interface language for front-built answers (demo, guided). Never sent to FastAPI. */
    locale: z.enum(["en", "es"]).optional(),
  })
  .strict();
export type Query = z.infer<typeof querySchema>;
export const blockSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("ExperimentCard"), experimentId: z.string() })
    .strict(),
  z
    .object({
      type: z.literal("CompareTable"),
      experimentIds: z.array(z.string()).min(2).max(6),
    })
    .strict(),
  z
    .object({ type: z.literal("GravityBounds"), explanation: z.string() })
    .strict(),
  z
    .object({ type: z.literal("SourceList"), sources: z.array(sourceSchema) })
    .strict(),
  evidenceBriefSchema,
  z
    .object({
      type: z.literal("DataTable"),
      title: z.string(),
      columns: z.array(z.string()),
      rows: z.array(z.array(cellSchema)),
    })
    .strict(),
  z
    .object({
      type: z.literal("Notice"),
      level: z.enum(["info", "warning"]),
      message: z.string(),
    })
    .strict(),
  z.object({ type: z.literal("Narrative"), markdown: z.string() }).strict(),
  z
    .object({
      type: z.literal("MapFocus"),
      title: z.string(),
      experimentIds: z.array(z.string()),
      gravity: briefGravitySchema.nullable(),
      note: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("FallbackCard"),
      markdown: z.string(),
      sources: z.array(sourceSchema),
    })
    .strict(),
]);
export type UIBlock = z.infer<typeof blockSchema>;
export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    queryId: z.string(),
    step: z.enum(progressSteps),
  }),
  z.object({
    type: z.literal("text-delta"),
    queryId: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("ui-block"),
    queryId: z.string(),
    block: z.unknown(),
  }),
  z.object({ type: z.literal("done"), queryId: z.string() }),
  z.object({
    type: z.literal("error"),
    queryId: z.string(),
    message: z.string(),
  }),
]);
export type CopilotEvent = z.infer<typeof eventSchema>;
export function validateBlock(
  value: unknown,
  locale: "en" | "es" = "en",
): UIBlock {
  const result = blockSchema.safeParse(value);
  const references =
    typeof value === "object" &&
    value !== null &&
    "sources" in value &&
    Array.isArray(value.sources)
      ? value.sources.flatMap((source) => {
          const parsed = sourceSchema.safeParse(source);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  return result.success
    ? result.data
    : {
        type: "FallbackCard",
        markdown:
          locale === "en"
            ? "**Incomplete answer.** This block could not be validated. You can try again; the rest of the evidence is still available."
            : "**Respuesta incompleta.** No se pudo validar este bloque. Puedes volver a intentarlo; las demás evidencias siguen disponibles.",
        sources: references,
      };
}
