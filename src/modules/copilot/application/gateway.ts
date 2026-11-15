import type { CopilotEvent, Query } from "../domain/contracts";
export interface CopilotGateway {
  query(query: Query, signal?: AbortSignal): AsyncIterable<CopilotEvent>;
}
