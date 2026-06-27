export default function MockModeBanner() {
  if (import.meta.env.VITE_INSTALLER_MOCK !== '1') return null;

  return (
    <div className="bg-warning/20 border-b border-warning/30 text-warning px-4 py-2 text-xs font-bold tracking-widest text-center uppercase shadow-danger flex items-center justify-center gap-2 relative z-50">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      Aviso de Segurança: MOCK MODE (VITE_INSTALLER_MOCK=1) — Ações destrutivas estão bloqueadas e desabilitadas localmente
    </div>
  );
}
