"use client";
import { AtlasMark } from "@/components/brand/atlas-mark";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { HttpCopilotGateway } from "../infra/http-gateway";
import { validateBlock, type Query, type UIBlock } from "../domain/contracts";
import { describeCopilotError } from "../domain/errors";
import {
  progressCopy,
  type Audience,
  type ProgressStep,
} from "../domain/brief";
import { BlockRenderer } from "./blocks";
import { setAudience } from "./audience-store";
import "./copilot.css";

type Message = {
  id: string;
  query: Query;
  text: string;
  blocks: UIBlock[];
  status: "loading" | "done" | "error" | "cancelled";
  error?: string;
};
const starters: {
  audience: Audience;
  who: string;
  chip: string;
  prompt: string;
  hint: string;
}[] = [
  {
    audience: "student",
    who: "Estudiante",
    chip: "¿Cómo cambia la llama sin gravedad?",
    prompt: "¿Cómo cambia una llama cuando no hay gravedad?",
    hint: "Una explicación sencilla y una pregunta para pensar.",
  },
  {
    audience: "teacher",
    who: "Docente",
    chip: "Compara µg vs 1g para PMMA",
    prompt: "Compara µg vs 1g para PMMA",
    hint: "Una actividad de clase: hipótesis, variables y qué observar.",
  },
  {
    audience: "researcher",
    who: "Investigador",
    chip: "Sólidos con más de 30 % de O₂",
    prompt: "¿Hay ensayos de sólidos con más de 30 % de O₂?",
    hint: "Filas exactas, rangos, descarga en CSV y cita.",
  },
];
const gateway = new HttpCopilotGateway();
const SLOW_AFTER_MS = 20000;

/** What is happening, in user terms. Steps never name agents; the list only grows. */
function Progress({
  steps,
  trials,
}: {
  steps: ProgressStep[];
  trials: number;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  const current = steps.at(-1);
  return (
    <div className="progress">
      <p role="status" className="progress-now">
        <i aria-hidden="true" />
        {current ? progressCopy(current, trials) : "Enviando la pregunta"}…
      </p>
      {steps.length > 1 && (
        <ol aria-hidden="true">
          {steps.slice(0, -1).map((step) => (
            <li key={step}>{progressCopy(step, trials)}</li>
          ))}
        </ol>
      )}
      {slow && (
        <small>
          Una ficha con fuentes puede tardar cerca de un minuto. Puedes seguir
          explorando el mapa mientras tanto.
        </small>
      )}
    </div>
  );
}
export function CopilotPanel({ mode }: { mode: "demo" | "remote" }) {
  const { state, dispatch, experiments } = useAtlas();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [steps, setSteps] = useState<ProgressStep[]>([]);
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
    setSteps([]);
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
        if (event.type === "progress")
          setSteps((current) =>
            current.includes(event.step) ? current : [...current, event.step],
          );
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
        setSteps([]);
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
    <aside
      id="contextual-evidence"
      className="copilot-panel evidence-paper"
      hidden={!state.assistantOpen}
      aria-label="Evidencia y asistente"
    >
      <header className="copilot-heading">
        <div className="copilot-icon" aria-hidden="true">
          <AtlasMark monochrome />
        </div>
        <div>
          <h2>Evidencia en contexto</h2>
          <span>
            {mode === "demo"
              ? "Demo · respuestas simuladas"
              : "Datos NASA PSI · en vivo"}
          </span>
        </div>
        <button
          className="close-evidence"
          aria-label="Cerrar evidencia y asistente"
          onClick={() => {
            dispatch({ type: "assistant", open: false });
            const toggle = document.getElementById(
              innerWidth < 1024 ? "mobile-evidence-toggle" : "evidence-toggle",
            );
            toggle?.focus({ preventScroll: true });
          }}
        >
          Cerrar
        </button>
      </header>
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
        {messages.length === 0 && (
          <section className="welcome-message" aria-labelledby="welcome-title">
            <h3 id="welcome-title">Del experimento a la evidencia</h3>
            <p>
              Contrasta lo que ves con los datos: conclusión, ensayos, fuentes y
              límites. Puedes seguir explorando el instrumento mientras preparas
              una pregunta.
            </p>
            <ul className="starters">
              {starters.map((starter) => (
                <li key={starter.audience}>
                  <button
                    type="button"
                    onClick={() => {
                      setAudience(starter.audience);
                      submit(starter.prompt);
                    }}
                  >
                    <span className="label">{starter.who}</span>
                    <strong>{starter.prompt}</strong>
                    <small>{starter.hint}</small>
                  </button>
                </li>
              ))}
            </ul>
            <p className="welcome-hint">
              También puedes tocar un ensayo o una zona vacía del mapa.
            </p>
          </section>
        )}
        {messages.map((message) => (
          <section
            className="chat-turn"
            key={message.id}
            aria-label="Intercambio con el copiloto"
          >
            <div className="user-message">{message.query.text}</div>
            <div className="assistant-label">
              <span aria-hidden="true">
                <AtlasMark monochrome />
              </span>{" "}
              Atlas <small>{mode === "demo" ? "Demo" : "Copiloto"}</small>
            </div>
            {message.text && <p className="assistant-text">{message.text}</p>}
            <div className="generated-blocks">
              {message.blocks.map((block, index) => (
                <div key={index}>
                  <BlockRenderer block={block} />
                </div>
              ))}
            </div>
            {message.status === "loading" && (
              <Progress steps={steps} trials={experiments.length} />
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
        {messages.length > 0 && (
          <div className="demo-chips">
            {starters.map((starter) => (
              <button
                key={starter.audience}
                type="button"
                onClick={() => {
                  setAudience(starter.audience);
                  submit(starter.prompt);
                }}
              >
                <span>{starter.who}</span>
                {starter.chip}
              </button>
            ))}
          </div>
        )}
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
            placeholder="Escribe tu pregunta…"
            rows={1}
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
