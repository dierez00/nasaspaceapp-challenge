import { NextResponse } from "next/server";
import {
  querySchema,
  type CopilotEvent,
} from "@/modules/copilot/domain/contracts";
import { DemoCopilotGateway } from "@/modules/copilot/infra/demo-gateway";
import {
  backendQuestion,
  translateBackendStream,
} from "@/modules/copilot/infra/backend-query";
import { psiApiRepository } from "@/modules/atlas/infra/psi-api";

const unavailable = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return unavailable("JSON inválido", 400);
  }
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return unavailable("Consulta inválida", 400);

  let events: AsyncGenerator<CopilotEvent>;
  if (process.env.ATLAS_DATA_MODE !== "remote") {
    events = new DemoCopilotGateway().query(parsed.data, request.signal);
  } else {
    const repository = psiApiRepository();
    if (!repository) return unavailable("Backend sin configurar", 503);
    let catalog;
    try {
      catalog = await repository.list(
        AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      );
    } catch {
      return unavailable("No se pudo conectar con el backend", 502);
    }
    if (process.env.ATLAS_QUERY_MODE === "remote") {
      // Agents in FastAPI: POST /query, translated to the copilot events.
      try {
        const upstream = await fetch(
          `${process.env.ATLAS_API_URL!.replace(/\/$/, "")}/query`,
          {
            method: "POST",
            body: JSON.stringify(backendQuestion(parsed.data)),
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            // Backend worst case without cache is ~68 s (classifier 8 + agents 20 + composer 2 x 20).
            signal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(90000),
            ]),
            cache: "no-store",
          },
        );
        if (!upstream.ok || !upstream.body)
          return unavailable("Backend no disponible", 502);
        events = translateBackendStream(
          upstream.body,
          parsed.data.queryId,
          catalog,
        );
      } catch {
        return unavailable("No se pudo conectar con el backend", 502);
      }
    } else {
      // Guided answers computed from the NASA PSI catalog, no agents.
      events = new DemoCopilotGateway(catalog, "psi").query(
        parsed.data,
        request.signal,
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await events.next();
        if (done) controller.close();
        else
          controller.enqueue(
            encoder.encode(
              `event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`,
            ),
          );
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
