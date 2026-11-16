"use client";
import { useState } from "react";
import { useAudience } from "@/modules/copilot/ui/audience-store";
import { useT } from "@/shared/i18n/locale";
import { useSimulation } from "../application/simulation-provider";

export function ExplorationGuide({ onCompare }: { onCompare: () => void }) {
  const audience = useAudience();
  const t = useT();
  const { state, edit } = useSimulation();
  const [changed, setChanged] = useState(false);
  const scenario = state.scenarios.A;
  if (audience === "researcher")
    return (
      <p className="precision-note">
        {t(
          "Exact parameters below. The phase is a visual choice: check conditions and outcomes in “Trials and sources”, not against the flame's appearance.",
          "Parámetros exactos abajo. La fase es una elección visual: contrasta condiciones y resultados en «Ensayos y fuentes», no con la apariencia de la llama.",
        )}
      </p>
    );
  return (
    <details className="exploration-guide">
      <summary>
        {audience === "teacher"
          ? t(
              "Activity: one variable, three gravities",
              "Actividad: una variable, tres gravedades",
            )
          : t(
              "Guided exploration: change a single variable",
              "Exploración guiada: cambia una sola variable",
            )}
      </summary>
      <p>
        {t(
          "Question: what changes if we keep the material and oxygen but lower the pressure? Form a hypothesis before you try.",
          "Pregunta: ¿qué cambia si mantenemos el material y el oxígeno, pero bajamos la presión? Antes de probar, formula una hipótesis.",
        )}
      </p>
      <div>
        <button onClick={onCompare}>
          {t("Compare the three gravities", "Comparar las tres gravedades")}
        </button>
        <button
          disabled={scenario.pressure <= 0}
          onClick={() => {
            edit("A", {
              pressure: Math.max(
                0,
                Math.round((scenario.pressure - 2) * 10) / 10,
              ),
            });
            setChanged(true);
          }}
        >
          {t("Lower pressure by 2 psi", "Reducir presión en 2 psi")}
        </button>
      </div>
      <p role="status">
        {changed
          ? t(
              `Current pressure: ${scenario.pressure.toFixed(1)} psi. The appearance is illustrative; find a nearby trial before drawing conclusions.`,
              `Presión actual: ${scenario.pressure.toFixed(1)} psi. La apariencia es ilustrativa; busca un ensayo próximo antes de concluir.`,
            )
          : t(
              "Keep everything else fixed. Watch the shape, then check it against a catalog trial.",
              "Mantén el resto fijo. Observa la forma; después contrasta con un ensayo del catálogo.",
            )}
      </p>
    </details>
  );
}
