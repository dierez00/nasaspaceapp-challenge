"use client";

import { useState } from "react";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { gravityLabels } from "@/modules/atlas/domain/experiment";
import { usePlayback, useSimulation } from "../application/simulation-provider";
import {
  comparisonGravities,
  gravityNames,
  qualitativeReading,
  timelineExplanation,
} from "../domain/comparison";
import {
  gravityProfile,
  physicsCallout,
  thresholdOutlook,
} from "../domain/gravity-model";

/** One column per gravity, aligned under its view: shape, transport, color, outlook. */
export function GravityIndicators() {
  const { experiments } = useAtlas();
  const { state } = useSimulation();
  const { time } = usePlayback();
  const base = state.scenarios.A;
  return (
    <div className="qualitative-grid" data-testid="gravity-indicators">
      {comparisonGravities.map((gravity) => {
        const profile = gravityProfile(gravity, base);
        const outlook = thresholdOutlook(experiments, base, gravity);
        return (
          <div
            key={gravity}
            data-focus={state.focusGravity === gravity ? "true" : undefined}
            data-gravity={gravity}
          >
            <h3>
              {gravityNames[gravity]} <span>{gravityLabels[gravity]}</span>
            </h3>
            <dl className="indicator-list">
              <div>
                <dt>Forma</dt>
                <dd>{profile.shape}</dd>
              </div>
              <div>
                <dt>Transporte</dt>
                <dd title={profile.transportNote}>{profile.transport}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>
                  {profile.colorCue}
                  <span
                    className="brightness-meter"
                    role="img"
                    aria-label="Brillo relativo, ilustrativo"
                    title="Brillo relativo entre las tres gravedades (ilustrativo, no es temperatura)"
                  >
                    <i style={{ width: `${profile.relativeBrightness * 100}%` }} />
                  </span>
                </dd>
              </div>
              <div>
                <dt>Cerca del umbral</dt>
                <dd>
                  <span className={`outlook is-${outlook.basis}`}>
                    {outlook.outlook}
                  </span>
                  <small>{outlook.label}</small>
                </dd>
              </div>
            </dl>
            <strong>
              {qualitativeReading({ ...base, gravity }, time)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

/** One physics callout at a time, keyed to the timeline; dismissible, below the views. */
export function PhysicsCallout() {
  const { state } = useSimulation();
  const { time } = usePlayback();
  const [hidden, setHidden] = useState(false);
  const callout = physicsCallout(time, state.scenarios.A.flameState);
  if (hidden)
    return (
      <button
        className="callout-restore"
        onClick={() => setHidden(false)}
      >
        Mostrar nota de física
      </button>
    );
  return (
    <aside
      className="physics-note"
      data-testid="physics-note"
      data-moment={callout.moment}
      aria-label="Nota de física"
    >
      <div>
        <h3>
          {callout.title} <span>· {timelineExplanation(time).title}</span>
        </h3>
        <p key={callout.moment}>{callout.text}</p>
      </div>
      <button
        type="button"
        aria-label="Ocultar nota de física"
        onClick={() => setHidden(true)}
      >
        ✕
      </button>
    </aside>
  );
}
