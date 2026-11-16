"use client";
import { AtlasMark } from "@/components/brand/atlas-mark";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { HttpCopilotGateway } from "../infra/http-gateway";
import { validateBlock, type Query, type UIBlock } from "../domain/contracts";
import { describeCopilotError } from "../domain/errors";
import {
  audienceLabel,
  progressCopy,
  type Audience,
  type ProgressStep,
} from "../domain/brief";
import { useLocale, useT, type Text } from "@/shared/i18n/locale";
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
  chip: Text;
  prompt: Text;
  hint: Text;
}[] = [
  {
    audience: "student",
    chip: {
      en: "How does a flame change without gravity?",
      es: "¿Cómo cambia la llama sin gravedad?",
    },
    prompt: {
      en: "How does a flame change when there is no gravity?",
      es: "¿Cómo cambia una llama cuando no hay gravedad?",
    },
    hint: {
      en: "A simple explanation and a question to think about.",
      es: "Una explicación sencilla y una pregunta para pensar.",
    },
  },
  {
    audience: "teacher",
    chip: {
      en: "Compare µg vs 1g for PMMA",
      es: "Compara µg vs 1g para PMMA",
    },
    prompt: {
      en: "Compare µg vs 1g for PMMA",
      es: "Compara µg vs 1g para PMMA",
    },
    hint: {
      en: "A classroom activity: hypothesis, variables and what to observe.",
      es: "Una actividad de clase: hipótesis, variables y qué observar.",
    },
  },
  {
    audience: "researcher",
    chip: {
      en: "Solids above 30 % O₂",
      es: "Sólidos con más de 30 % de O₂",
    },
    prompt: {
      en: "Are there trials of solids above 30 % O₂?",
      es: "¿Hay ensayos de sólidos con más de 30 % de O₂?",
    },
    hint: {
      en: "Exact rows, ranges, CSV download and citation.",
      es: "Filas exactas, rangos, descarga en CSV y cita.",
    },
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
  const locale = useLocale();
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  const current = steps.at(-1);
  return (
    <div className="progress">
      <p role="status" className="progress-now">
        <i aria-hidden="true" />
        {current
          ? progressCopy(current, trials, locale)
          : t("Sending the question", "Enviando la pregunta")}
        …
      </p>
      {steps.length > 1 && (
        <ol aria-hidden="true">
          {steps.slice(0, -1).map((step) => (
            <li key={step}>{progressCopy(step, trials, locale)}</li>
          ))}
        </ol>
      )}
      {slow && (
        <small>
          {t(
            "A brief with sources can take about a minute. You can keep exploring the map in the meantime.",
            "Una ficha con fuentes puede tardar cerca de un minuto. Puedes seguir explorando el mapa mientras tanto.",
          )}
        </small>
      )}
    </div>
  );
}
export function CopilotPanel({ mode }: { mode: "demo" | "remote" }) {
  const { state, dispatch, experiments } = useAtlas();
  const locale = useLocale();
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const active = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );
  const history = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  // The stream callback outlives renders; read the current language from a ref.
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  const busy = messages.some((message) => message.status === "loading");
  const start = useCallback(async (asked: Query) => {
    // Front-built answers (demo, guided) follow the interface language.
    const query: Query = { ...asked, locale: localeRef.current };
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
                  blocks: [
                    ...message.blocks,
                    validateBlock(event.block, query.locale),
                  ],
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
                error: describeCopilotError(error, localeRef.current),
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
  const pinned = useRef<string | null>(null);
  useEffect(() => {
    const container = history.current;
    const last = messages.at(-1);
    if (!container || !last) return;
    // A new answer opens at its verdict; progress and errors keep following the end.
    if (last.blocks.length > 0) {
      if (pinned.current !== last.id) {
        pinned.current = last.id;
        follow.current = false;
        const turn = container.querySelector<HTMLElement>(
          ".chat-turn:last-of-type",
        );
        if (turn)
          container.scrollTop +=
            turn.getBoundingClientRect().top -
            container.getBoundingClientRect().top;
      }
      return;
    }
    if (follow.current) container.scrollTop = container.scrollHeight;
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
      aria-label={t("Assistant AI", "Evidencia y asistente")}
    >
      <header className="copilot-heading">
        <div className="copilot-icon" aria-hidden="true">
          <AtlasMark monochrome />
        </div>
        <div>
          <h2>{t("Evidence in context", "Evidencia en contexto")}</h2>
          <span>
            {mode === "demo"
              ? t("Demo · simulated answers", "Demo · respuestas simuladas")
              : t("NASA PSI data · live", "Datos NASA PSI · en vivo")}
          </span>
        </div>
        <button
          className="close-evidence"
          aria-label={t(
            "Close Assistant AI",
            "Cerrar evidencia y asistente",
          )}
          onClick={() => {
            dispatch({ type: "assistant", open: false });
            const toggle = document.getElementById(
              innerWidth < 1024 ? "mobile-evidence-toggle" : "evidence-toggle",
            );
            toggle?.focus({ preventScroll: true });
          }}
        >
          {t("Close", "Cerrar")}
        </button>
      </header>
      <div
        className="chat-history"
        ref={history}
        role="log"
        aria-label={t("Conversation history", "Historial de la conversación")}
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
            <h3 id="welcome-title">
              {t(
                "From experiment to evidence",
                "Del experimento a la evidencia",
              )}
            </h3>
            <p>
              {t(
                "Check what you see against the data: conclusion, trials, sources and limits. You can keep exploring the instrument while you prepare a question.",
                "Contrasta lo que ves con los datos: conclusión, ensayos, fuentes y límites. Puedes seguir explorando el instrumento mientras preparas una pregunta.",
              )}
            </p>
            <ul className="starters">
              {starters.map((starter) => (
                <li key={starter.audience}>
                  <button
                    type="button"
                    onClick={() => {
                      setAudience(starter.audience);
                      submit(starter.prompt[locale]);
                    }}
                  >
                    <span className="label">
                      {audienceLabel(starter.audience, locale)}
                    </span>
                    <strong>{starter.prompt[locale]}</strong>
                    <small>{starter.hint[locale]}</small>
                  </button>
                </li>
              ))}
            </ul>
            <p className="welcome-hint">
              {t(
                "You can also tap a trial or an empty area of the map.",
                "También puedes tocar un ensayo o una zona vacía del mapa.",
              )}
            </p>
          </section>
        )}
        {messages.map((message) => (
          <section
            className="chat-turn"
            key={message.id}
            aria-label={t(
              "Exchange with the copilot",
              "Intercambio con el copiloto",
            )}
          >
            <div className="user-message">{message.query.text}</div>
            <div className="assistant-label">
              <span aria-hidden="true">
                <AtlasMark monochrome />
              </span>{" "}
              Atlas{" "}
              <small>
                {mode === "demo" ? "Demo" : t("Copilot", "Copiloto")}
              </small>
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
                <strong>
                  {t(
                    "The answer was not completed.",
                    "No se completó la respuesta.",
                  )}
                </strong>
                <p>{message.error}</p>
                <button
                  onClick={() =>
                    void start({
                      ...message.query,
                      queryId: crypto.randomUUID(),
                    })
                  }
                >
                  {t("Retry query", "Reintentar consulta")} ↻
                </button>
              </div>
            )}
            {message.status === "cancelled" && (
              <p className="subtle-note" role="status">
                {t(
                  "Query cancelled. The answer received so far is kept.",
                  "Consulta cancelada. Se conserva la respuesta recibida.",
                )}
              </p>
            )}
          </section>
        ))}
      </div>
      <div className="chat-composer">
        {messages.length > 0 && suggestionsOpen && (
          <div className="demo-chips" id="composer-suggestions">
            {starters.map((starter) => (
              <button
                key={starter.audience}
                type="button"
                onClick={() => {
                  setSuggestionsOpen(false);
                  setAudience(starter.audience);
                  submit(starter.prompt[locale]);
                }}
              >
                <span>{audienceLabel(starter.audience, locale)}</span>
                {starter.chip[locale]}
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
            {t("Ask the copilot", "Pregunta al copiloto")}
          </label>
          <textarea
            id="atlas-question"
            placeholder={t("Type your question…", "Escribe tu pregunta…")}
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
                aria-label={t("Cancel query", "Cancelar consulta")}
                onClick={() => active.current?.controller.abort()}
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                aria-label={t("Send query", "Enviar consulta")}
                disabled={!input.trim()}
              >
                ↑
              </button>
            )}
          </div>
        </form>
        <div className="composer-foot">
          {messages.length > 0 && (
            <button
              type="button"
              className="suggest-toggle"
              aria-expanded={suggestionsOpen}
              aria-controls="composer-suggestions"
              onClick={() => setSuggestionsOpen((open) => !open)}
            >
              {t("Suggestions", "Sugerencias")} {suggestionsOpen ? "▴" : "▾"}
            </button>
          )}
          <p>
            {mode === "demo"
              ? t(
                  "Synthetic data · No safety predictions",
                  "Datos sintéticos · Sin predicciones de seguridad",
                )
              : t(
                  "Check the answers against their original sources",
                  "Contrasta las respuestas con sus fuentes originales",
                )}
          </p>
        </div>
      </div>
    </aside>
  );
}
