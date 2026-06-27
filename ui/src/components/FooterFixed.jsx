import { useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
export default function FooterFixed({
  progressLabel,
  issues = [],
  canBack,
  canNext,
  onBack,
  onNext,
  nextLabel = 'Próximo',
  hintText = 'Pronto para avançar. Navegação rápida: Alt + ← / Alt + →',
}) {
  const { t } = useTranslation();
  const lockRef    = useRef(false);
  const [busy, setBusy] = useState(false);

  async function runLocked(action, enabled) {
    if (!enabled || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    try {
      await action?.();
    } finally {
      window.setTimeout(() => {
        lockRef.current = false;
        setBusy(false);
      }, 250);
    }
  }

  const hint = issues.length > 0
    ? `⚠ ${issues[0]}`
    : hintText;

  return (
    <footer className="ftr">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => runLocked(onBack, canBack && !busy)}
        disabled={!canBack || busy}
      >
        {t('common.back')}
      </button>

      <span className="step-info">
        <span style={{ color: 'var(--text3)', fontSize: '11px' }}>{progressLabel}</span>
        {issues.length > 0 ? (
          <span style={{ display: 'block', color: 'var(--warning)', fontSize: '11px' }}>
            {hint}
          </span>
        ) : (
          <span
            className="kbd-legend"
            style={{ display: 'block', color: 'var(--text3)', fontSize: '10px', letterSpacing: '0.3px' }}
          >
            {t('nav.readyHint') || "Enter/Alt+N: Próximo · Alt+B: Voltar"}
          </span>
        )}
      </span>

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => runLocked(onNext, canNext && !busy)}
        disabled={!canNext || busy}
      >
        {nextLabel} →
      </button>
    </footer>
  );
}
