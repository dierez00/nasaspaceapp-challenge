import { NextResponse } from "next/server";
import { querySchema } from "@/modules/copilot/domain/contracts";
import { DemoCopilotGateway } from "@/modules/copilot/infra/demo-gateway";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = querySchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json({ error: "Consulta inválida" }, { status: 400 });
  if (process.env.ATLAS_DATA_MODE === "remote") {
    if (!process.env.ATLAS_API_URL)
      return NextResponse.json(
        { error: "Backend sin configurar" },
        { status: 503 },
      );
    try {
      const upstream = await fetch(
        `${process.env.ATLAS_API_URL.replace(/\/$/, "")}/query`,
        {
          method: "POST",
          body: JSON.stringify(parsed.data),
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
          cache: "no-store",
        },
      );
      if (!upstream.ok || !upstream.body)
        return NextResponse.json(
          { error: "Backend no disponible" },
          { status: 502 },
        );
      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "No se pudo conectar con el backend" },
        { status: 502 },
      );
    }
  }
  const iterator = new DemoCopilotGateway().query(parsed.data, request.signal);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
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
      await iterator.return(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
