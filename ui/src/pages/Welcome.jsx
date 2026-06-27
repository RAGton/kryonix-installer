import { useEffect, useState } from 'react';

export default function Welcome() {
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
  const detectedInstall = detections.find(d => d.is_kryonix);

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="section-panel flex min-h-0 flex-col justify-between overflow-y-auto">
        <div>
          <div className="metric-chip">Instalacao assistida Kryonix</div>
          <h2 className="mt-5 max-w-3xl text-3xl font-black leading-tight text-white">
            Configure o host com revisao clara antes de qualquer alteracao destrutiva.
          </h2>

          {hasKryonix && (
            <div className="mt-6 rounded-[24px] border border-cyan-300/30 bg-cyan-200/10 p-4 shadow-lg shadow-cyan-950/20">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]"></span>
                Instalação Kryonix detectada
              </div>
              <p className="mt-2 text-sm text-cyan-100/70">
                Detectamos o host <span className="text-white font-mono">{detectedInstall?.hostname}</span> em <span className="text-white font-mono">{detectedInstall?.device}</span>.
                Recomendamos o <strong>Modo Restore</strong> no passo de particionamento.
              </p>
            </div>
          )}

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            O wizard coleta rede, perfil, discos, usuario e features em etapas curtas.
            No fim, voce revisa o plano antes de iniciar a instalacao.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="section-panel bg-white/5">
            <div className="text-sm font-bold text-white">Fluxo guiado</div>
            <p className="mt-2 text-sm text-slate-400">Cada decisao fica isolada em uma etapa, com validacao antes de avancar.</p>
          </div>
          <div className="section-panel bg-white/5">
            <div className="text-sm font-bold text-white">Revisao final</div>
            <p className="mt-2 text-sm text-slate-400">Disco, rede, usuario e features aparecem no resumo antes da execucao.</p>
          </div>
          <div className="section-panel bg-white/5">
            <div className="text-sm font-bold text-white">Operacao local</div>
            <p className="mt-2 text-sm text-slate-400">A interface conversa com o backend local da ISO e evita depender de servicos externos.</p>
          </div>
        </div>

        {version && (
          <div className="mt-6 text-[10px] text-slate-500 font-mono">
            {version.KRYONIX_PRETTY_NAME} | {version.KRYONIX_REV?.substring(0, 8)} | {version.KRYONIX_BUILD_TIME}
          </div>
        )}
      </section>

      <section className="section-panel flex min-h-0 flex-col justify-center overflow-hidden">
        <div className="mx-auto flex h-full max-h-[420px] w-full max-w-[520px] items-center justify-center">
          <div className="w-full max-w-xl text-center">
            <svg viewBox="0 0 200 80" className="w-full h-auto mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#dff6ff" stopOpacity="1"/>
                  <stop offset="55%" stopColor="#5ac8ff" stopOpacity="1"/>
                  <stop offset="100%" stopColor="#0a84ff" stopOpacity="1"/>
                </linearGradient>
              </defs>
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle"
                    fontFamily="system-ui, sans-serif" fontSize="42" fontWeight="800"
                    fill="url(#grad)" letterSpacing="0">Kryonix</text>
              <text x="50%" y="75%" dominantBaseline="middle" textAnchor="middle"
                    fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="500"
                    fill="#64748b" letterSpacing="0" textTransform="uppercase">Installer</text>
              <path d="M24 24H176" stroke="url(#grad)" strokeWidth="1.8" strokeLinecap="round" opacity="0.42"/>
              <path d="M42 66H158" stroke="#5ac8ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.32"/>
            </svg>
            <p className="mt-6 text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
              Interface minimalista com vidro fosco, foco em contraste e movimento
              discreto para manter a instalacao legivel em modo kiosk.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
