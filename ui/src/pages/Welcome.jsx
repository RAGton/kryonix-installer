import { useEffect, useState } from 'react';
import EagleLogo from '../components/EagleLogo';

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
      <div className="mb-12 flex flex-col items-center">
        <div className="mb-8 p-4 bg-white/50 dark:bg-bg-elevated/30 border border-slate-200/50 dark:border-white/5 rounded-3xl shadow-sm backdrop-blur-xl">
          <EagleLogo className="w-16 h-16 text-accent-blue" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-text-primary mb-3">
          Configuração do Ambiente
        </h2>
        <p className="text-base text-slate-500 dark:text-text-secondary max-w-lg font-medium">
          O Kryonix Installer guiará você pela preparação da infraestrutura. Defina a preferência visual antes de prosseguir.
        </p>
      </div>

      {/* Detections */}
      {hasKryonix && (
        <div className="mb-12 w-full max-w-lg rounded-2xl border border-accent-blue/20 bg-accent-blue/5 p-5 flex gap-4 text-left">
          <div className="mt-1"><EagleLogo className="w-5 h-5 text-accent-blue" /></div>
          <div>
            <div className="text-sm font-bold text-accent-blue mb-1">
              Infraestrutura Existente Detectada
            </div>
            <p className="text-sm text-slate-600 dark:text-text-secondary leading-relaxed">
              O nó <span className="font-mono bg-white dark:bg-bg-elevated px-1.5 py-0.5 rounded text-xs border border-slate-200 dark:border-white/10">{detections[0].hostname}</span> já opera Kryonix. 
              Para manutenções, o <strong>Modo Restore</strong> é recomendado na etapa de discos.
            </p>
          </div>
        </div>
      )}

      {/* Theme Selection */}
      <div className="w-full max-w-2xl mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Light Mode Card */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex flex-col items-start p-6 rounded-2xl border transition-all duration-300 text-left ${
              currentMode === 'light'
                ? 'border-accent-blue bg-white dark:bg-bg-elevated shadow-panel ring-1 ring-accent-blue/20'
                : 'border-slate-200/50 bg-white/50 dark:border-white/5 dark:bg-bg-surface/50 hover:bg-white dark:hover:bg-bg-surface'
            }`}
          >
            <div className="w-full h-24 mb-5 rounded-lg bg-slate-50 border border-slate-200/50 flex flex-col p-2.5 gap-2 overflow-hidden">
              <div className="h-3.5 w-full bg-white rounded shadow-sm border border-slate-100"></div>
              <div className="flex gap-2 flex-1">
                <div className="w-1/4 h-full bg-white rounded shadow-sm border border-slate-100"></div>
                <div className="flex-1 h-full bg-white rounded shadow-sm border border-slate-100 p-1.5">
                  <div className="w-1/3 h-1.5 bg-slate-200 rounded"></div>
                </div>
              </div>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-text-primary mb-1">Light Mode</span>
            <span className="text-xs text-slate-500 dark:text-text-muted font-medium">Contraste limpo para ambientes iluminados</span>
          </button>

          {/* Dark Mode Card */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex flex-col items-start p-6 rounded-2xl border transition-all duration-300 text-left ${
              currentMode === 'dark'
                ? 'border-accent-blue bg-white dark:bg-bg-elevated shadow-panel ring-1 ring-accent-blue/20'
                : 'border-slate-200/50 bg-white/50 dark:border-white/5 dark:bg-bg-surface/50 hover:bg-white dark:hover:bg-bg-surface'
            }`}
          >
            <div className="w-full h-24 mb-5 rounded-lg bg-bg-surface border border-white/5 flex flex-col p-2.5 gap-2 overflow-hidden shadow-inner">
              <div className="h-3.5 w-full bg-bg-elevated rounded border border-white/5"></div>
              <div className="flex gap-2 flex-1">
                <div className="w-1/4 h-full bg-bg-elevated rounded border border-white/5"></div>
                <div className="flex-1 h-full bg-bg-glass backdrop-blur-md rounded border border-white/5 p-1.5 shadow-sm">
                  <div className="w-1/3 h-1.5 bg-accent-blue/30 rounded"></div>
                </div>
              </div>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-text-primary mb-1">Dark Mode</span>
            <span className="text-xs text-slate-500 dark:text-text-muted font-medium">Estética profunda e confortável aos olhos</span>
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
