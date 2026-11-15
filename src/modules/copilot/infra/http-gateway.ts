import type { CopilotGateway } from "../application/gateway";
import {
  eventSchema,
  type CopilotEvent,
  type Query,
} from "../domain/contracts";
import { CopilotError, messageForStatus } from "../domain/errors";

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<CopilotEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const abort = () => {
    void reader.cancel();
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) yield eventSchema.parse(JSON.parse(data));
      }
      if (done) {
        if (buffer.trim()) throw new CopilotError("Stream incompleto.");
        break;
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export class HttpCopilotGateway implements CopilotGateway {
  constructor(private url = "/api/atlas/query") {}
  async *query(query: Query, signal?: AbortSignal) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
      signal,
    });
    if (!response.ok || !response.body)
      throw new CopilotError(messageForStatus(response.status));
    let completed = false;
    for await (const event of parseSSE(response.body, signal)) {
      if (event.queryId !== query.queryId) continue;
      if (event.type === "error") throw new CopilotError(event.message);
      yield event;
      if (event.type === "done") {
        completed = true;
        break;
      }
    }
    if (!completed)
      throw new CopilotError(
        "La conexión terminó antes de completar la respuesta.",
      );
  }
}
