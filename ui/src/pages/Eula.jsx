import { useEffect, useState } from 'react';

function HwCard({ icon, label, value, sub }) {
  return (
    <div className="bg-bg-light-glass dark:bg-bg-elevated border border-slate-200/50 dark:border-white/5 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-text-secondary">
        {icon} <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-slate-900 dark:text-text-primary truncate" title={value ?? '—'}>
        {value ?? '—'}
      </div>
      {sub && <div className="text-[11px] text-slate-500 dark:text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function StatusRow({ icon, label, value, ok }) {
  const valueColor = ok === true
    ? 'text-success'
    : ok === false
      ? 'text-danger'
      : 'text-slate-600 dark:text-text-secondary';

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-slate-400 dark:text-text-muted text-sm">{icon}</span>
        <span className="text-xs font-medium text-slate-600 dark:text-text-secondary">{label}</span>
      </div>
      <span className={`text-xs font-bold ${valueColor}`}>{value ?? '—'}</span>
    </div>
  );
}

export default function Eula({ uiState, onChange, validation }) {
  const [probe, setProbe]       = useState(null);
  const [scanning, setScanning] = useState(true);
  const [offline, setOffline]   = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/probe')
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => {
        if (active) { setProbe(data); setScanning(false); }
      })
      .catch(() => {
        if (active) { setScanning(false); setOffline(true); }
      });
    return () => { active = false; };
  }, []);

  const cpu  = probe?.cpu;
  const disk = Array.isArray(probe?.disks) ? probe.disks[0] : probe?.disks;
  const gpu0 = Array.isArray(probe?.gpu) ? probe.gpu[0] : probe?.gpu;
  const boot = probe?.boot_mode;
  const net  = probe?.network;
  const virt = probe?.virtualization;

  const cpuLabel = cpu?.model
    ? cpu.model.replace(/\(.*\)/g, '').trim().split(' ').slice(-4).join(' ')
    : null;
  const cpuSub = cpu?.cores != null
    ? `${cpu.cores} núcleos${cpu?.threads != null ? ` · ${cpu.threads} threads` : ''}`
    : null;
  const memGb   = probe?.memory_gb ?? probe?.memory?.total_gb;
  const memVal  = memGb != null ? `${memGb} GB` : null;
  const memSub  = probe?.memory?.available_gb != null ? `${probe.memory.available_gb} GB livres` : null;
  const diskVal = disk?.path ?? disk?.name ?? null;
  const diskSub = disk?.size_gb != null ? `${disk.size_gb} GB` : (disk?.size ?? null);
  const gpuVal  = gpu0?.model ?? gpu0?.name ?? (gpu0 ? 'Integrada' : null);
  const gpuSub  = gpu0?.vram_gb != null ? `${gpu0.vram_gb} GB VRAM` : null;

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 md:gap-8 h-full">
      {/* ── Coluna esquerda: hardware ── */}
      <div className="flex-1 flex flex-col gap-6 max-w-sm shrink-0">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-text-primary">
            Ambiente Detectado
          </h2>
          {scanning ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-text-secondary">
              <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
              Verificando hardware...
            </div>
          ) : offline ? (
            <div className="flex items-center gap-2 text-xs font-medium text-danger">
              <span className="shrink-0">✗</span> MOCK MODE: Dados simulados
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-success">
              <span className="shrink-0">✓</span> Diagnóstico concluído
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <HwCard icon="⬡" label="CPU"   value={cpuLabel} sub={cpuSub} />
          <HwCard icon="▣" label="RAM"   value={memVal}   sub={memSub} />
          <HwCard icon="◈" label="Disco" value={diskVal}  sub={diskSub} />
          <HwCard icon="◇" label="GPU"   value={gpuVal}   sub={gpuSub} />
        </div>

        <div className="bg-bg-light-glass dark:bg-bg-elevated border border-slate-200/50 dark:border-white/5 rounded-xl px-4 py-2 shadow-sm flex flex-col">
          <StatusRow
            icon="⬛"
            label="Boot mode"
            value={boot ?? '—'}
            ok={boot === 'UEFI' ? true : boot === 'BIOS' ? null : null}
          />
          <StatusRow
            icon="◎"
            label="Internet"
            value={net?.internet ? 'Conectado' : net ? 'Offline' : '—'}
            ok={net?.internet === true ? true : net ? false : null}
          />
          <StatusRow
            icon="⬡"
            label="Virtualização"
            value={virt ?? '—'}
            ok={null}
          />
          <StatusRow
            icon="◈"
            label="Interface"
            value={net?.interface ?? '—'}
            ok={null}
          />
        </div>
      </div>

      {/* ── Coluna direita: termos + aceite ── */}
      <div className="flex-[1.5] flex flex-col min-w-0 bg-white/40 dark:bg-bg-surface border border-slate-200/50 dark:border-white/5 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        
        <div className="shrink-0 mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-text-primary">Termos de Operação</h2>
          <p className="text-sm text-slate-500 dark:text-text-secondary mt-1">
            Por favor, analise as implicações do processo antes de prosseguir.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-4 text-sm text-slate-600 dark:text-text-secondary custom-scrollbar">
          <div className="flex gap-3">
            <span className="font-bold text-accent-blue">1.</span>
            <p>O sistema KryonixOS será instalado com perfil canônico, substituindo qualquer OS anterior na partição selecionada.</p>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-accent-blue">2.</span>
            <p>A etapa de armazenamento <strong>pode ser destrutiva</strong>. O particionamento automático apagará a tabela de partições do disco alvo.</p>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-accent-blue">3.</span>
            <p>Você é responsável por revisar cuidadosamente a seleção de discos, interfaces de rede, região e senhas de administração.</p>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-accent-blue">4.</span>
            <p>Falhas de fornecimento de energia durante o processo de flash (após o início da escrita de blocos) podem corromper a unidade.</p>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-accent-blue">5.</span>
            <p>Garanta que possui backup de qualquer dado importante contido no hardware listado na coluna de diagnóstico.</p>
          </div>
        </div>

        <div className="shrink-0 pt-4 border-t border-slate-200/50 dark:border-white/10 mt-auto">
          <label className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
            uiState.eulaAccepted 
              ? 'bg-accent-blue/5 border-accent-blue/30 dark:bg-accent-blue/10 dark:border-accent-blue/50' 
              : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-bg-elevated dark:border-white/10 dark:hover:border-white/20'
          }`}>
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 rounded border-slate-300 text-accent-blue focus:ring-accent-blue/50 shrink-0 cursor-pointer"
              checked={uiState.eulaAccepted}
              onChange={e => onChange({ eulaAccepted: e.target.checked })}
            />
            <div className="flex flex-col">
              <span className={`text-sm font-bold ${uiState.eulaAccepted ? 'text-accent-blue' : 'text-slate-900 dark:text-text-primary'}`}>
                Compreendo os riscos e aceito os termos
              </span>
              <span className="text-xs text-slate-500 dark:text-text-muted mt-1">
                Confirmo que verifiquei os dados do ambiente detectado e autorizo a instalação.
              </span>
            </div>
          </label>

          {validation?.blockingIssues?.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
              {validation.blockingIssues[0]}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
