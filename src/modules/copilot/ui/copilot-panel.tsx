"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { HttpCopilotGateway } from "../infra/http-gateway";
import { validateBlock, type Query, type UIBlock } from "../domain/contracts";
import { describeCopilotError } from "../domain/errors";
import { BlockRenderer, GravityBounds } from "./blocks";

type Message = {
  id: string;
  query: Query;
  text: string;
  blocks: UIBlock[];
  status: "loading" | "done" | "error" | "cancelled";
  error?: string;
};
const chips = ["Sólidos > 30% O₂", "Comparar µg vs 1g", "Análogos E-FIELD"];
const agents = [
  { id: "analyst", name: "Analista PSI" },
  { id: "physics", name: "Física de Llama RAG" },
  { id: "synthesizer", name: "Sintetizador" },
];
const gateway = new HttpCopilotGateway();
export function CopilotPanel({ mode }: { mode: "demo" | "remote" }) {
  const { state, dispatch } = useAtlas();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const active = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );
  const history = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const busy = messages.some((message) => message.status === "loading");
  const start = useCallback(async (query: Query) => {
    active.current?.controller.abort();
    const controller = new AbortController();
    active.current = { id: query.queryId, controller };
    setStatuses({});
    follow.current = true;
    setMessages((current) => [
      ...current.map((message) =>
        message.status === "loading"
          ? { ...message, status: "cancelled" as const }
          : message,
      ),
      { id: query.queryId, query, text: "", blocks: [], status: "loading" },
    ]);
    try {
      for await (const event of gateway.query(query, controller.signal)) {
        if (active.current?.id !== query.queryId) return;
        if (event.type === "agent-status")
          setStatuses((current) => ({
            ...current,
            [event.agent]: event.status,
          }));
        else
          setMessages((current) =>
            current.map((message) => {
              if (message.id !== query.queryId) return message;
              if (event.type === "text-delta")
                return { ...message, text: message.text + event.text };
              if (event.type === "ui-block")
                return {
                  ...message,
                  blocks: [...message.blocks, validateBlock(event.block)],
                };
              if (event.type === "done") return { ...message, status: "done" };
              return message;
            }),
          );
      }
    } catch (error) {
      if (active.current?.id !== query.queryId) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === query.queryId
            ? {
                ...message,
                status: controller.signal.aborted ? "cancelled" : "error",
                error: describeCopilotError(error),
              }
            : message,
        ),
      );
    } finally {
      if (active.current?.id === query.queryId) {
        active.current = null;
        setStatuses({});
      }
    }
  }, []);
  useEffect(() => {
    if (!state.pending) return;
    const query = state.pending;
    const timer = setTimeout(() => {
      dispatch({ type: "clear-query" });
      void start(query);
    }, 0);
    return () => clearTimeout(timer);
  }, [state.pending, dispatch, start]);
  useEffect(
    () => () => {
      active.current?.controller.abort();
    },
    [],
  );
  useEffect(() => {
    if (messages.length > 0 && follow.current && history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [messages]);
  function submit(text: string) {
    if (!text.trim()) return;
    setInput("");
    void start({ version: 1, queryId: crypto.randomUUID(), text: text.trim() });
  }
  return (
    <aside className="copilot-panel" aria-label="Copiloto de investigación">
      <header className="copilot-heading">
        <div className="copilot-icon">✳</div>
        <div>
          <h2>Copiloto de investigación</h2>
          <span>
            {mode === "demo" ? "" : "DATOS NASA PSI · CONEXIÓN SSE"}
          </span>
        </div>
        <span className="copilot-menu" aria-hidden="true">
          ⌘
        </span>
      </header>
      <div className="agent-telemetry" aria-label="Telemetría de agentes">
        {agents.map((agent) => (
          <span
            key={agent.id}
            className={statuses[agent.id] === "working" ? "working" : ""}
          >
            <i className={statuses[agent.id] === "done" ? "complete" : ""} />
            {agent.name}
          </span>
        ))}
      </div>
      <div
        className="chat-history"
        ref={history}
        role="log"
        aria-label="Historial de la conversación"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={() => {
          const element = history.current;
          if (element)
            follow.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              80;
        }}
      >
        <div className="conversation-date" />
        <section className="welcome-message">
          <div className="assistant-label">
            <span>✳</span> ATLAS{" "}
            <small>{mode === "demo" ? "DEMO" : "COPILOTO"}</small>
          </div>
          <h3>
            ¿Cómo arde el fuego
            <br />
            lejos de la Tierra?
          </h3>
          <p>
            Explora las condiciones que transforman una llama. Cruza evidencias
            y descubre el espacio entre lo que sabemos y lo que falta por
            probar.
          </p>
          <GravityBounds explanation="El centro es una pregunta abierta. La silueta lunar es ilustrativa, no una predicción." />
          <p className="welcome-hint">
            Selecciona una muestra en el mapa o empieza con una pregunta.
          </p>
        </section>
        {messages.map((message) => (
          <section
            className="chat-turn"
            key={message.id}
            aria-label="Intercambio con el copiloto"
          >
            <div className="user-message">{message.query.text}</div>
            <div className="assistant-label">
              <span>✳</span> ATLAS{" "}
              <small>{mode === "demo" ? "DEMO" : "COPILOTO"}</small>
            </div>
            {message.text && <p className="assistant-text">{message.text}</p>}
            <div className="generated-blocks">
              {message.blocks.map((block, index) => (
                <div
                  key={index}
                  style={{
                    animationDelay: `${40 + Math.min(index, 2) * 100}ms`,
                  }}
                >
                  <BlockRenderer block={block} />
                </div>
              ))}
            </div>
            {message.status === "loading" && (
              <p role="status" className="thinking">
                {mode === "demo"
                  ? "Preparando exploración simulada"
                  : "Consultando evidencias"}
                <span> · · ·</span>
              </p>
            )}
            {message.status === "error" && (
              <div className="chat-error" role="alert">
                <strong>No se completó la respuesta.</strong>
                <p>{message.error}</p>
                <button
                  onClick={() =>
                    void start({
                      ...message.query,
                      queryId: crypto.randomUUID(),
                    })
                  }
                >
                  Reintentar consulta ↻
                </button>
              </div>
            )}
            {message.status === "cancelled" && (
              <p className="subtle-note" role="status">
                Consulta cancelada. Se conserva la respuesta recibida.
              </p>
            )}
          </section>
        ))}
      </div>
      <div className="chat-composer">
        <div className="demo-chips">
          {chips.map((chip, index) => (
            <button key={chip} onClick={() => submit(chip)}>
              <span>{["ϟ", "↔", "⌁"][index]}</span>
              {chip}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
        >
          <label className="sr-only" htmlFor="atlas-question">
            Pregunta al copiloto
          </label>
          <textarea
            id="atlas-question"
            placeholder="Pregunta sobre el fuego en la Luna…"
            rows={2}
            maxLength={2000}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit(input);
              }
            }}
          />
          <div className="composer-bottom">
            <span />
            {busy ? (
              <button
                type="button"
                aria-label="Cancelar consulta"
                onClick={() => active.current?.controller.abort()}
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Enviar consulta"
                disabled={!input.trim()}
              >
                ↑
              </button>
            )}
          </div>
        </form>
        <p>
          {mode === "demo"
            ? ""
            : "Contrasta las respuestas con sus fuentes originales"}
        </p>
      </div>
    </aside>
  );
}
