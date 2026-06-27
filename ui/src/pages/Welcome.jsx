import { useEffect, useState } from 'react';

export default function Welcome({ draft, onChange }) {
  const [version, setVersion] = useState(null);
  const [detections, setDetections] = useState([]);

  useEffect(() => {
    fetch('/version')
      .then(r => r.ok ? r.json() : null)
      .then(data => setVersion(data))
      .catch(() => {});

    fetch('/api/detection')
      .then(r => r.ok ? r.json() : [])
      .then(data => setDetections(data))
      .catch(() => {});
  }, []);

  const hasKryonix = detections.some(d => d.is_kryonix);

  const setTheme = (mode) => {
    onChange({
      draftPatch: {
        installerUiTheme: mode,
        desktopThemeMode: mode,
      }
    });
  };

  const currentMode = draft?.installerUiTheme || 'dark';

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto w-full px-4 text-center animate-fade-in-up">
      {/* Branding */}
      <div className="mb-10 flex flex-col items-center">
        <div className="w-20 h-20 mb-6 bg-gradient-to-br from-accent-blue to-accent-cyan rounded-2xl shadow-xl shadow-accent-blue/20 flex items-center justify-center">
          <span className="text-4xl text-white font-bold tracking-tighter">K</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
          Bem-vindo ao Kryonix
        </h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl">
          Instalador redesenhado para estabilidade operacional e design premium. Configure seu sistema em poucos passos.
        </p>
      </div>

      {/* Detections */}
      {hasKryonix && (
        <div className="mb-10 w-full max-w-lg rounded-xl border border-accent-blue/30 bg-accent-blue/5 p-4 animate-pulse">
          <div className="flex items-center justify-center gap-2 text-accent-blue dark:text-accent-blue font-bold">
            <span className="h-2 w-2 rounded-full bg-accent-blue"></span>
            Instalação Kryonix detectada
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Detectamos o host <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded">{detections[0].hostname}</span>.
            Recomendamos o <strong>Modo Restore</strong> na etapa de particionamento.
          </p>
        </div>
      )}

      {/* Theme Selection */}
      <div className="w-full max-w-2xl mb-12">
        <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Aparência do Sistema</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Light Mode Card */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex flex-col items-center p-6 rounded-2xl border-2 transition-all duration-200 ${
              currentMode === 'light'
                ? 'border-accent-blue bg-white shadow-lg ring-4 ring-accent-blue/10 dark:bg-slate-800'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-border dark:bg-bg-elevated dark:hover:border-slate-600'
            }`}
          >
            <div className="w-full h-24 mb-4 rounded-lg bg-slate-100 border border-slate-200 flex flex-col p-2 gap-1.5 overflow-hidden">
              <div className="h-3 w-full bg-white rounded shadow-sm border border-slate-100"></div>
              <div className="flex gap-1.5 flex-1">
                <div className="w-1/4 h-full bg-white rounded shadow-sm border border-slate-100"></div>
                <div className="flex-1 h-full bg-white rounded shadow-sm border border-slate-100 p-1">
                  <div className="w-1/2 h-2 bg-accent-blue/20 rounded"></div>
                </div>
              </div>
            </div>
            <span className="font-bold text-slate-900 dark:text-white">Claro</span>
            <span className="text-xs text-slate-500 mt-1">Gelo e azul discreto</span>
          </button>

          {/* Dark Mode Card */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex flex-col items-center p-6 rounded-2xl border-2 transition-all duration-200 ${
              currentMode === 'dark'
                ? 'border-accent-blue bg-white shadow-lg ring-4 ring-accent-blue/10 dark:bg-slate-800/80 dark:shadow-[0_0_30px_rgba(59,130,246,0.15)]'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-border dark:bg-bg-elevated dark:hover:border-slate-600'
            }`}
          >
            <div className="w-full h-24 mb-4 rounded-lg bg-slate-900 border border-slate-700 flex flex-col p-2 gap-1.5 overflow-hidden shadow-inner">
              <div className="h-3 w-full bg-slate-800 rounded border border-slate-700/50"></div>
              <div className="flex gap-1.5 flex-1">
                <div className="w-1/4 h-full bg-slate-800 rounded border border-slate-700/50"></div>
                <div className="flex-1 h-full bg-slate-800/80 backdrop-blur-sm rounded border border-slate-700/50 p-1 shadow-glass">
                  <div className="w-1/2 h-2 bg-accent-blue/40 rounded"></div>
                </div>
              </div>
            </div>
            <span className="font-bold text-slate-900 dark:text-white">Escuro</span>
            <span className="text-xs text-slate-500 mt-1">Blue glass premium (Padrão)</span>
          </button>
        </div>
      </div>

      {version && (
        <div className="mt-auto text-[10px] text-slate-400 dark:text-slate-600 font-mono">
          {version.KRYONIX_PRETTY_NAME} | {version.KRYONIX_REV?.substring(0, 8)} | {version.KRYONIX_BUILD_TIME}
        </div>
      )}
    </div>
  );
}
