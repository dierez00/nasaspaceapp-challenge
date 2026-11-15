"use client";

export function Dashboard() {
  return (
    <section
      id="dashboard"
      className="flex flex-col justify-center items-center min-h-screen w-full px-6 py-16 md:px-12 lg:px-20 bg-slate-950 text-slate-100 border-t border-slate-850 relative overflow-hidden"
    >
      <span id="componentes" className="sr-only">Área de Componentes</span>
      
      {/* Sutil gradiente de fondo aeroespacial */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] pointer-events-none opacity-20 blur-[120px]"
        style={{
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(139, 92, 246, 0.1) 50%, transparent 80%)"
        }}
      />

      <div className="w-full max-w-6xl mx-auto flex flex-col items-center relative z-10">
        {/* Encabezado de la sección de componentes */}
        <div className="text-center max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-slate-900/90 border border-cyan-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono text-[11px] font-semibold tracking-widest text-cyan-400 uppercase">
              ÁREA DE INSTRUMENTACIÓN // FASE 2
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Workspace del Atlas
          </h2>
          <p className="text-base sm:text-lg text-slate-400 font-mono text-sm leading-relaxed">
            Espacio reservado para los componentes interactivos, visualizadores D3.js y paneles de telemetría NASA PSI.
          </p>
        </div>

        {/* Tarjeta contenedora elevada */}
        <div className="w-full bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 p-8 sm:p-12 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Espacio / Slot 1 */}
            <div className="flex flex-col justify-between p-6 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/40 transition-colors min-h-[260px]">
              <div>
                <span className="font-mono text-[11px] font-bold text-cyan-400 uppercase block mb-2">
                  COMPONENTE 01
                </span>
                <h3 className="text-xl font-bold text-slate-100 mb-2">
                  Mapa D3 de Huecos
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-sans">
                  Lienzo interactivo de dispersión y límites de inflamabilidad en función de oxígeno (% O₂) y presión (psi).
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 font-mono text-[11px] text-cyan-400/80">
                [ Contenedor D3.js ]
              </div>
            </div>

            {/* Espacio / Slot 2 */}
            <div className="flex flex-col justify-between p-6 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 transition-colors min-h-[260px]">
              <div>
                <span className="font-mono text-[11px] font-bold text-amber-400 uppercase block mb-2">
                  COMPONENTE 02
                </span>
                <h3 className="text-xl font-bold text-slate-100 mb-2">
                  Controles de Gravedad
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-sans">
                  Barra de filtros de precisión para alternar entre microgravedad (µg ISS), gravedad lunar (1/6g) y terrestre (1g).
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 font-mono text-[11px] text-amber-400/80">
                [ Filtros de Gravedad ]
              </div>
            </div>

            {/* Espacio / Slot 3 */}
            <div className="flex flex-col justify-between p-6 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 transition-colors min-h-[260px]">
              <div>
                <span className="font-mono text-[11px] font-bold text-emerald-400 uppercase block mb-2">
                  COMPONENTE 03
                </span>
                <h3 className="text-xl font-bold text-slate-100 mb-2">
                  Panel de Investigaciones
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-sans">
                  Visualización de registros experimentales de NASA PSI (SAFFIRE, ACME) y telemetría de ensayos reales.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 font-mono text-[11px] text-emerald-400/80">
                [ Fichas &amp; Telemetría ]
              </div>
            </div>
          </div>

          {/* Botón de retorno al Hero */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex justify-end">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="font-mono text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5"
            >
              ↑ Volver a la Escotilla (Hero)
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
