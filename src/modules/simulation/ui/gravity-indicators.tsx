"use client";

import { useState } from "react";
import { useAtlas } from "@/modules/atlas/ui/atlas-provider";
import { useLocale, useT } from "@/shared/i18n/locale";
import { gravityLabels } from "@/modules/atlas/domain/experiment";
import { usePlayback, useSimulation } from "../application/simulation-provider";
import {
  comparisonGravities,
  gravityNames,
  qualitativeReading,
  timelineExplanation,
} from "../domain/comparison";
import {
  NEAR_TOLERANCE,
  gravityProfile,
  outlookLabels,
  physicsCallout,
  shapeLabels,
  thresholdOutlook,
  transportLabels,
} from "../domain/gravity-model";

/** One column per gravity, aligned under its view: shape, transport, color, outlook. */
export function GravityIndicators() {
  const { experiments } = useAtlas();
  const { state } = useSimulation();
  const { time } = usePlayback();
  const locale = useLocale();
  const t = useT();
  const base = state.scenarios.A;
  return (
    <div className="qualitative-grid" data-testid="gravity-indicators">
      {comparisonGravities.map((gravity) => {
        const profile = gravityProfile(gravity, base, locale);
        const outlook = thresholdOutlook(
          experiments,
          base,
          gravity,
          NEAR_TOLERANCE,
          locale,
        );
        return (
          <div
            key={gravity}
            data-focus={state.focusGravity === gravity ? "true" : undefined}
            data-gravity={gravity}
          >
            <h3>
              {gravityNames[gravity][locale]}{" "}
              <span>{gravityLabels[gravity]}</span>
            </h3>
            <dl className="indicator-list">
              <div>
                <dt>{t("Shape", "Forma")}</dt>
                <dd>{shapeLabels[profile.shape][locale]}</dd>
              </div>
              <div>
                <dt>{t("Transport", "Transporte")}</dt>
                <dd title={profile.transportNote}>
                  {transportLabels[profile.transport][locale]}
                </dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>
                  {profile.colorCue}
                  <span
                    className="brightness-meter"
                    role="img"
                    aria-label={t(
                      "Relative brightness, illustrative",
                      "Brillo relativo, ilustrativo",
                    )}
                    title={t(
                      "Relative brightness across the three gravities (illustrative, not a temperature)",
                      "Brillo relativo entre las tres gravedades (ilustrativo, no es temperatura)",
                    )}
                  >
                    <i
                      style={{ width: `${profile.relativeBrightness * 100}%` }}
                    />
                  </span>
                </dd>
              </div>
              <div>
                <dt>{t("Near the threshold", "Cerca del umbral")}</dt>
                <dd>
                  <span className={`outlook is-${outlook.basis}`}>
                    {outlookLabels[outlook.outlook][locale]}
                  </span>
                  <small>{outlook.label}</small>
                </dd>
              </div>
            </dl>
            <strong>
              {qualitativeReading({ ...base, gravity }, time, locale)}
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
  const locale = useLocale();
  const t = useT();
  const callout = physicsCallout(time, state.scenarios.A.flameState, locale);
  if (hidden)
    return (
      <button className="callout-restore" onClick={() => setHidden(false)}>
        {t("Show physics note", "Mostrar nota de física")}
      </button>
    );
  return (
    <aside
      className="physics-note"
      data-testid="physics-note"
      data-moment={callout.moment}
      aria-label={t("Physics note", "Nota de física")}
    >
      <div>
        <h3>
          {callout.title}{" "}
          <span>· {timelineExplanation(time, locale).title}</span>
        </h3>
        <p key={callout.moment}>{callout.text}</p>
      </div>
      <button
        type="button"
        aria-label={t("Hide physics note", "Ocultar nota de física")}
        onClick={() => setHidden(true)}
      >
        ✕
      </button>
    </aside>
  );
}
