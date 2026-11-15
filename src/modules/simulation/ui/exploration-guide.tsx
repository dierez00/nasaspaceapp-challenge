"use client";
import { useState } from "react";
import { useAudience } from "@/modules/copilot/ui/audience-store";
import { useSimulation } from "../application/simulation-provider";

export function ExplorationGuide({ onCompare }: { onCompare: () => void }) {
  const audience = useAudience();
  const { state, edit } = useSimulation();
  const [changed, setChanged] = useState(false);
  const scenario = state.scenarios.A;
  if (audience === "researcher")
    return (
      <p className="precision-note">
        Parámetros exactos abajo. La fase es una elección visual: contrasta
        condiciones y resultados en «Ensayos y fuentes», no con la apariencia de
        la llama.
      </p>
    );
  return (
    <details className="exploration-guide">
      <summary>
        {audience === "teacher"
          ? "Actividad: una variable, tres gravedades"
          : "Exploración guiada: cambia una sola variable"}
      </summary>
      <p>
        Pregunta: ¿qué cambia si mantenemos el material y el oxígeno, pero
        bajamos la presión? Antes de probar, formula una hipótesis.
      </p>
      <div>
        <button onClick={onCompare}>Comparar las tres gravedades</button>
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
          Reducir presión en 2 psi
        </button>
      </div>
      <p role="status">
        {changed
          ? `Presión actual: ${scenario.pressure.toFixed(1)} psi. La apariencia es ilustrativa; busca un ensayo próximo antes de concluir.`
          : "Mantén el resto fijo. Observa la forma; después contrasta con un ensayo del catálogo."}
      </p>
    </details>
  );
}
