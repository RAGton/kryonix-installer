import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from './components/Layout.jsx';
import FooterFixed from './components/FooterFixed.jsx';
import Login from './pages/Login.jsx';
import Welcome from './pages/Welcome.jsx';
import Eula from './pages/Eula.jsx';
import Network from './pages/Network.jsx';
import Source from './pages/Source.jsx';
import RemoteAccess from './pages/RemoteAccess.jsx';
import HostSelection from './pages/HostSelection.jsx';
import MachineProfile from './pages/MachineProfile.jsx';
import SystemFeatures from './pages/SystemFeatures.jsx';
import UserFeatures from './pages/UserFeatures.jsx';
import Disks from './pages/Disks.jsx';
import Users from './pages/Users.jsx';
import Summary from './pages/Summary.jsx';
import Install from './pages/Install.jsx';
import { validateStep } from './utils/installPlan.js';
import { installerApi, getInstallerApiErrorMessage } from './utils/installerApi.js';
import {
  createInstallPlanDraft,
  extractUiTransientState,
  INITIAL_INSTALL_PLAN_DRAFT,
  INITIAL_UI_TRANSIENT_STATE,
  mergeWizardState,
  readStoredWizardState,
  splitWizardPatch,
  writeStoredWizardState,
} from './state/wizardState.js';

// Converte máscara IPv4 dotted-decimal em prefix length (/N).
// Default 24 quando a máscara é inválida — alinhado com o catálogo de
// opções da página Network ("/24" como primeiro valor).
function netmaskToPrefix(netmask) {
  const normalized = (netmask || '').trim();
  if (!normalized) return 24;
  const parts = normalized.split('.');
  if (parts.length !== 4) return 24;
  let bits = 0;
  let seenZero = false;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return 24;
    for (let bit = 7; bit >= 0; bit -= 1) {
      const current = (octet >> bit) & 1;
      if (current === 1) {
        if (seenZero) return 24;
        bits += 1;
      } else {
        seenZero = true;
      }
    }
  }
  return bits;
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Kryonix Installer',
    subtitle: 'Fluxo imersivo, fullscreen, sem rolagem global e com foco em robustez operacional.',
  },
  {
    id: 'eula',
    title: 'EULA e Avisos',
    subtitle: 'Aceite explícito antes de qualquer ação destrutiva ou configuração do sistema.',
  },
  {
    id: 'network',
    title: 'Topologia de Rede',
    subtitle: 'WAN, LAN e parâmetros essenciais de rede.',
  },
  {
    id: 'source',
    title: 'Fonte de Instalação',
    subtitle: 'Offline ou repositório GitHub remoto.',
  },
  {
    id: 'hostSelection',
    title: 'Identificação',
    subtitle: 'Nome da máquina na rede.',
  },
  {
    id: 'profile',
    title: 'Perfil',
    subtitle: 'Carga inicial de configurações para o seu caso de uso.',
  },
  {
    id: 'systemFeatures',
    title: 'Features de Sistema',
    subtitle: 'Ferramentas globais, IA, virtualização e acesso remoto.',
  },
  {
    id: 'userFeatures',
    title: 'Features de Usuário',
    subtitle: 'Editores, shells, temas e ferramentas de desenvolvimento.',
  },
  {
    id: 'disks',
    title: 'Particionamento',
    subtitle: 'Visualização técnica de discos com validação alinhada ao contrato canônico.',
  },
  {
    id: 'users',
    title: 'Usuário e SSH',
    subtitle: 'Conta administrativa, senha forte e chaves SSH autorizadas.',
  },
  {
    id: 'summary',
    title: 'Resumo final',
    subtitle: 'Revisão final antes de gerar o plano e iniciar a instalação.',
  },
  {
    id: 'install',
    title: 'Instalação',
    subtitle: 'Execução em tempo real com status, logs e resultado final.',
  },
];

function getInitialWizardState() {
  const stored = readStoredWizardState();

  return {
    stepIndex: Math.max(0, Math.min(stored?.stepIndex ?? 0, STEPS.length - 1)),
    draft: stored?.draft ?? createInstallPlanDraft(INITIAL_INSTALL_PLAN_DRAFT),
    uiState: stored?.uiState ?? extractUiTransientState(INITIAL_UI_TRANSIENT_STATE),
  };
}

export default function App() {
  const initialState = useMemo(() => getInitialWizardState(), []);
  const [stepIndex, setStepIndex] = useState(initialState.stepIndex);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [wizardState, setWizardState] = useState({
    draft: initialState.draft,
    uiState: initialState.uiState,
  });

  const draft = wizardState.draft;
  const uiState = wizardState.uiState;
  const wizard = useMemo(() => mergeWizardState(draft, uiState), [draft, uiState]);
  const step = STEPS[stepIndex];
  const eulaLocked = step.id === 'eula';
  const progressValue = STEPS.length > 1
    ? Math.round((stepIndex / (STEPS.length - 1)) * 100)
    : 100;

  const currentValidation = useMemo(
    () => validateStep(step.id, draft, uiState),
    [draft, step.id, uiState],
  );

  const footerIssues = currentValidation.blockingIssues.length > 0
    ? currentValidation.blockingIssues
    : currentValidation.warnings;
  const canGoNext = currentValidation.blockingIssues.length === 0;

  useEffect(() => {
    writeStoredWizardState({ stepIndex, draft, uiState });
  }, [draft, stepIndex, uiState]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setRequiresLogin(true);
    };

    // Test initial connection
    fetch('/version', {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('kryonixSessionToken') || ''}`
      }
    }).then(res => {
      if (res.status === 401) {
        setRequiresLogin(true);
      }
    }).catch(() => {});

    window.addEventListener('kryonix-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('kryonix-unauthorized', handleUnauthorized);
  }, []);

  const updateWizard = useCallback((patchOrUpdater) => {
    setWizardState((previous) => {
      const previousView = mergeWizardState(previous.draft, previous.uiState);
      const nextPatch = typeof patchOrUpdater === 'function'
        ? patchOrUpdater(previousView)
        : patchOrUpdater;

      const { draftPatch, uiPatch } = splitWizardPatch(nextPatch);

      return {
        draft: Object.keys(draftPatch).length > 0
          ? createInstallPlanDraft({ ...previous.draft, ...draftPatch })
          : previous.draft,
        uiState: Object.keys(uiPatch).length > 0
          ? extractUiTransientState({ ...previous.uiState, ...uiPatch })
          : previous.uiState,
      };
    });
  }, []);

  const goNext = useCallback(
    () => setStepIndex((previous) => Math.min(STEPS.length - 1, previous + 1)),
    [],
  );

  // Handle network step next: apply network config before advancing
  const handleNetworkNext = useCallback(async () => {
    if (step.id !== 'network') {
      goNext();
      return;
    }

    const { applyNetwork } = installerApi;
    const mode = draft.mgmtMode || 'dhcp';
    const iface = draft.mgmtInterface;

    if (!iface) {
      // No interface selected, just advance
      goNext();
      return;
    }

    // Limpa estado de erro/pendência antes de uma nova tentativa de aplicar.
    updateWizard({ netApplyError: '', netApplyBusy: true, networkDhcpPending: false });

    let applyResult;
    try {
      if (mode === 'dhcp') {
        // Apply DHCP
        applyResult = await applyNetwork({
          interface: iface,
          mode: 'dhcp',
          address: '',
          prefix_length: 24,
          gateway: '',
          dns: (draft.mgmtDns || '1.1.1.1,8.8.8.8').split(',').map(d => d.trim()).filter(Boolean),
        });

        if (applyResult?.applied && applyResult?.ip && applyResult.ip !== '0.0.0.0') {
          // Save detected IP to wizard
          updateWizard({ serverIp: applyResult.ip, mgmtGateway: applyResult.gateway || '', mgmtDns: applyResult.dns?.join(',') || draft.mgmtDns, netApplyBusy: false });
        } else {
          // DHCP aplicado mas ainda sem lease/IP: avanço permitido com aviso visível.
          updateWizard({ networkDhcpPending: true, netApplyBusy: false });
        }
      } else {
        // Static mode - validate and apply
        const address = draft.serverIp;
        const prefix = draft.mgmtNetmask ? netmaskToPrefix(draft.mgmtNetmask) : 24;
        const gateway = draft.mgmtGateway;
        const dns = draft.mgmtDns || '1.1.1.1,8.8.8.8';

        if (!address || !gateway) {
          // Modo estático incompleto: erro visível, sem avanço silencioso.
          updateWizard({
            netApplyError: 'Modo estático: informe IP do servidor e gateway antes de aplicar.',
            netApplyBusy: false,
          });
          return;
        }

        applyResult = await applyNetwork({
          interface: iface,
          mode: 'static',
          address,
          prefix_length: prefix,
          gateway,
          dns: dns.split(',').map(d => d.trim()).filter(Boolean),
        });

        if (applyResult?.applied) {
          updateWizard({ serverIp: applyResult.ip, mgmtGateway: applyResult.gateway || gateway, mgmtDns: applyResult.dns?.join(',') || dns, netApplyBusy: false });
        } else {
          // Backend não aplicou: erro visível, não avança.
          updateWizard({
            netApplyError: 'O backend não aplicou a configuração de rede (/network/apply). Verifique interface, IP e gateway.',
            netApplyBusy: false,
          });
          return;
        }
      }
    } catch (err) {
      console.error('[Network] applyNetwork failed:', err);
      // Erro de comunicação/exceção: mensagem visível na UI, sem avanço.
      updateWizard({
        netApplyError: getInstallerApiErrorMessage(err, 'Falha ao aplicar a configuração de rede (/network/apply).'),
        netApplyBusy: false,
      });
      return;
    }

    // Advance to next step
    goNext();
  }, [step.id, draft, goNext, updateWizard]);

  const advanceWizardSafely = useCallback(() => {
    if (step.id === 'network') {
      return handleNetworkNext();
    }
    goNext();
    return Promise.resolve();
  }, [step.id, handleNetworkNext, goNext]);

  const goBack = useCallback(
    () => setStepIndex((previous) => Math.max(0, previous - 1)),
    [],
  );

  // Força transição automática para a tela de instalação APENAS quando
  // a instalação real está em andamento (installRunning = true).
  // O dry-run não deve forçar nem travar a navegação permanentemente.
  useEffect(() => {
    if (uiState.installRunning) {
      setStepIndex(STEPS.length - 1);
    }
  }, [uiState.installRunning]);

  // Navegação por teclado (Gate 6 — keyboard-only). Atalhos de "Próximo":
  // Enter (fora de campos), Alt+N, Alt+→, Ctrl+Enter. "Voltar": Alt+B, Alt+←, Alt+Backspace.
  // Esc é no-op: nunca sai do kiosk nem fecha o Chromium.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (uiState.installRunning) {
        event.preventDefault();
        return;
      }
      // Rede sendo aplicada: bloqueia TODA navegação por teclado. Sem este gate
      // o handler chama advanceWizardSafely() direto (fora do lock do footer),
      // permitindo Enter/Alt+N repetidos dispararem handleNetworkNext concorrentes
      // e corromperem o wizardState (netApplyBusy era write-only).
      if (uiState.netApplyBusy) {
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        return;
      }
      // F1 (Ajuda) / F2 (Logs): reservados — impede a ajuda nativa do Chromium.
      // (overlays de ajuda/logs entram numa próxima iteração da Fase 0.2)
      if (event.key === 'F1' || event.key === 'F2') {
        event.preventDefault();
        return;
      }

      const tag = event.target?.tagName;
      const isTyping =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable;

      const k = event.key;
      const explicitNext =
        (event.altKey && (k === 'n' || k === 'N' || k === 'ArrowRight')) ||
        (event.ctrlKey && k === 'Enter');
      const bareEnterNext = k === 'Enter' && !isTyping && !event.altKey && !event.ctrlKey;
      const wantBack =
        event.altKey && (k === 'b' || k === 'B' || k === 'ArrowLeft' || k === 'Backspace');

      // EULA: Enter "pelado" NÃO avança (evita aceite acidental); só atalho explícito
      // e somente após o aceite (canGoNext). O Space no checkbox continua nativo.
      if (step.id === 'eula') {
        if (k === 'Enter' && !isTyping) event.preventDefault();
        if (explicitNext && canGoNext) {
          event.preventDefault();
          void advanceWizardSafely();
        }
        return;
      }

      if (wantBack) {
        event.preventDefault();
        goBack();
        return;
      }
      if ((explicitNext || bareEnterNext) && canGoNext) {
        event.preventDefault();
        void advanceWizardSafely();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advanceWizardSafely, canGoNext, step.id, goBack, uiState.installRunning, uiState.netApplyBusy]);

  // Foco inicial previsível: ao trocar de etapa, foca o primeiro elemento
  // interativo da página (EULA → checkbox, Disks → primeiro card, Users → 1º campo).
  const pageRef = useRef(null);
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const sel =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])';
    const el = root.querySelector(sel);
    if (el && typeof el.focus === 'function') {
      // requestAnimationFrame: garante que a etapa já montou antes de focar
      requestAnimationFrame(() => el.focus());
    }
  }, [stepIndex]);

  const stepsWithState = useMemo(
    () => STEPS.map((item, index) => ({
      ...item,
      status: index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'upcoming',
    })),
    [stepIndex],
  );

  const pageProps = {
    draft,
    uiState,
    wizard,
    onChange: updateWizard,
    validation: currentValidation,
  };

  const currentPage = (() => {
    switch (step.id) {
      case 'welcome':
        return <Welcome />;
      case 'eula':
        return <Eula {...pageProps} />;
      case 'network':
        return <Network {...pageProps} />;
      case 'source':
        return <Source {...pageProps} />;
      case 'remoteAccess':
        return <RemoteAccess {...pageProps} />;
      case 'hostSelection':
        return <HostSelection {...pageProps} />;
      case 'profile':
        return <MachineProfile {...pageProps} />;
      case 'systemFeatures':
        return <SystemFeatures {...pageProps} />;
      case 'userFeatures':
        return <UserFeatures {...pageProps} />;
      case 'disks':
        return <Disks {...pageProps} />;
      case 'users':
        return <Users {...pageProps} />;
      case 'summary':
        return <Summary {...pageProps} />;
      case 'install':
        return <Install {...pageProps} />;
      default:
        return null;
    }
  })();

  if (requiresLogin) {
    return <Login onLoginSuccess={() => setRequiresLogin(false)} />;
  }

  return (
    <Layout
      title={step.title}
      subtitle={step.subtitle}
      stepLabel={`Etapa ${stepIndex + 1} de ${STEPS.length}`}
      steps={stepsWithState}
      currentStepIndex={stepIndex}
      navigationHint={uiState.installRunning ? 'Navegação bloqueada' : uiState.netApplyBusy ? 'Aplicando rede…' : eulaLocked ? 'Atalhos bloqueados na EULA' : 'Alt + ← / Alt + →'}
      onStepJump={(index) => {
        if (uiState.installRunning) return;
        if (uiState.netApplyBusy) return;
        if (step.id === 'eula') return;
        if (index <= stepIndex) {
          setStepIndex(index);
          return;
        }
        if (index === stepIndex + 1 && canGoNext) {
          void advanceWizardSafely();
        }
      }}
      footer={(
        <FooterFixed
          progressLabel={`${step.title} • ${progressValue}%`}
          progressValue={progressValue}
          issues={footerIssues}
          canBack={stepIndex > 0 && !uiState.installRunning && !uiState.netApplyBusy}
          canNext={step.id === 'install' ? false : canGoNext && !uiState.installRunning && !uiState.netApplyBusy}
          onBack={() => setStepIndex((previous) => Math.max(0, previous - 1))}
          // advanceWizardSafely centraliza avanço: no step network chama
          // /network/apply via handleNetworkNext; nos demais passos delega
          // para goNext, mantendo paridade com o comportamento antigo.
          onNext={advanceWizardSafely}
          hintText={
            uiState.installRunning
              ? 'Instalação em andamento. Não desligue a VM.'
              : uiState.netApplyBusy
                ? 'Aplicando configuração de rede… aguarde.'
              : step.id === 'eula'
                ? 'Nesta etapa, o avanço só é permitido pelo botão Próximo após marcar o aceite.'
                : 'Pronto para avançar. Navegação rápida: Alt + ← / Alt + →'
          }
          nextLabel={uiState.netApplyBusy ? 'Aplicando rede…' : step.id === 'summary' ? 'Ir para instalação' : step.id === 'install' ? 'Em execução' : 'Próximo'}
        />
      )}
    >
      <div className="wizard-page" ref={pageRef} style={{ display: 'contents' }}>
        {currentPage}
      </div>
    </Layout>
  );
}
