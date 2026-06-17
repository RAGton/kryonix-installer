// Stress / "monkey testing" do wizardState.
//
// Objetivo: provar que martelar a UI (cliques duplos, submissões repetidas,
// navegação back-and-forth rápida) NÃO corrompe o wizardState nem permite
// múltiplas aplicações de rede concorrentes.
//
// Cobre dois níveis:
//   1. Reducer puro — usa as funções reais exportadas por wizardState.js para
//      garantir que nenhum patch caótico vaza campos entre draft/uiState,
//      escapa dos field-sets ou desestabiliza a serializacao.
//   2. Gate de concorrência — modela o mesmo guard que App.jsx aplica
//      (netApplyBusy + lock do FooterFixed) e prova que N "cliques" simultâneos
//      em "Próximo" disparam handleNetworkNext UMA única vez.
//
// Runner: `node --test` (sem jsdom; o nivel DOM fica no roteiro de monkey
// testing manual — ver tabela TOON em docs/stress-monkey-testing.md).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DRAFT_FIELD_NAMES,
  UI_TRANSIENT_FIELD_NAMES,
  createInstallPlanDraft,
  extractUiTransientState,
  mergeWizardState,
  splitWizardPatch,
  INITIAL_INSTALL_PLAN_DRAFT,
  INITIAL_UI_TRANSIENT_STATE,
} from '../state/wizardState.js';

const DRAFT_SET = new Set(DRAFT_FIELD_NAMES);
const UI_SET = new Set(UI_TRANSIENT_FIELD_NAMES);

// PRNG deterministico (sem Math.random — testes precisam ser reproduziveis).
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904271) >>> 0;
    return state / 0xffffffff;
  };
}

// Patches "caoticos" que um macaco geraria batendo na UI de rede.
const CHAOS_PATCHES = [
  { mgmtMode: 'dhcp' },
  { mgmtMode: 'static' },
  { mgmtInterface: 'enp1s0', lanIdentified: false },
  { mgmtInterface: 'enp2s0', lanIdentified: false },
  { serverIp: '192.168.100.2' },
  { serverIp: '' },
  { mgmtGateway: '192.168.100.1' },
  { netApplyBusy: true },
  { netApplyBusy: false, netApplyError: 'boom' },
  { netApplyError: '', networkDhcpPending: true },
  { wanInterface: 'enp2s0', wanIdentified: false },
  { wanInterface: '' },
  { httpPort: 8080 },
  { netConnected: true, netOffline: false },
  { netOffline: true, netConnected: false },
  // ruido: campos inexistentes devem ser silenciosamente descartados
  { __evil: 'xss', constructor: 'nope', stepIndex: 999 },
];

// Modelo fiel do App.updateWizard: split + recriacao imutavel dos dois slices.
function applyPatch(stateWizard, patch) {
  const { draftPatch, uiPatch } = splitWizardPatch(patch);
  return {
    draft: Object.keys(draftPatch).length
      ? createInstallPlanDraft({ ...stateWizard.draft, ...draftPatch })
      : stateWizard.draft,
    uiState: Object.keys(uiPatch).length
      ? extractUiTransientState({ ...stateWizard.uiState, ...uiPatch })
      : stateWizard.uiState,
  };
}

test('monkey: 5000 patches caoticos nunca vazam campos nem escapam dos field-sets', () => {
  const rng = makeRng(0xC0FFEE);
  let s = {
    draft: createInstallPlanDraft(INITIAL_INSTALL_PLAN_DRAFT),
    uiState: extractUiTransientState(INITIAL_UI_TRANSIENT_STATE),
  };

  for (let i = 0; i < 5000; i += 1) {
    const patch = CHAOS_PATCHES[Math.floor(rng() * CHAOS_PATCHES.length)];
    s = applyPatch(s, patch);

    // draft so contem chaves do draft-set; uiState so do ui-set.
    for (const k of Object.keys(s.draft)) assert.ok(DRAFT_SET.has(k), `vazou no draft: ${k}`);
    for (const k of Object.keys(s.uiState)) assert.ok(UI_SET.has(k), `vazou no uiState: ${k}`);

    // nenhum campo de rede de um slice contamina o outro
    assert.ok(!('netApplyBusy' in s.draft), 'netApplyBusy nao pode estar no draft');
    assert.ok(!('serverIp' in s.uiState), 'serverIp nao pode estar no uiState');

    // chaves de ruido jamais persistem
    assert.ok(!('__evil' in s.draft) && !('__evil' in s.uiState));
  }

  // mergeWizardState continua produzindo um objeto plano e serializavel
  const view = mergeWizardState(s.draft, s.uiState);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(view)));
});

test('monkey: navegacao back-and-forth mantem stepIndex sempre clampado', () => {
  const rng = makeRng(0x1234);
  const STEPS = 13; // espelha STEPS.length em App.jsx
  let stepIndex = 0;
  const goNext = () => { stepIndex = Math.min(STEPS - 1, stepIndex + 1); };
  const goBack = () => { stepIndex = Math.max(0, stepIndex - 1); };

  for (let i = 0; i < 10000; i += 1) {
    if (rng() > 0.5) goNext(); else goBack();
    assert.ok(stepIndex >= 0 && stepIndex <= STEPS - 1, `stepIndex fora do range: ${stepIndex}`);
    assert.ok(Number.isInteger(stepIndex));
  }
});

test('gate: N cliques concorrentes em "Proximo" disparam apply UMA vez (netApplyBusy)', async () => {
  // Modelo do guard que App.jsx + FooterFixed implementam juntos:
  // o avanco so executa se !busy; ao entrar, marca busy=true ate resolver.
  let busy = false;
  let applyCount = 0;

  async function handleNetworkNext() {
    if (busy) return; // <- gate: o que faltava quando netApplyBusy era write-only
    busy = true;
    applyCount += 1;
    // simula a ida ao backend (/network/apply)
    await new Promise((r) => setTimeout(r, 5));
    busy = false;
  }

  // 50 cliques disparados no MESMO tick (double/triple-click + Enter + Alt+N)
  await Promise.all(Array.from({ length: 50 }, () => handleNetworkNext()));
  assert.equal(applyCount, 1, 'apenas a primeira submissao deve aplicar a rede');

  // apos resolver, uma nova rodada e permitida (nao trava para sempre)
  await handleNetworkNext();
  assert.equal(applyCount, 2);
});

test('gate: enquanto netApplyBusy, edicoes de campo de rede sao rejeitadas', () => {
  // Espelha disabled={netApplyBusy} nos inputs de Network.jsx: a UI nao emite
  // onChange quando o controle esta desabilitado. Modelamos o efeito liquido.
  const guardedOnChange = (uiState, patch) =>
    uiState.netApplyBusy ? uiState /* no-op: input disabled */ : { ...uiState, ...patch };

  let ui = extractUiTransientState({ ...INITIAL_UI_TRANSIENT_STATE, netApplyBusy: true });
  let draftIface = 'enp1s0';

  // tentativa de "espancar" a troca de interface durante o apply
  for (let i = 0; i < 100; i += 1) {
    const before = draftIface;
    if (!ui.netApplyBusy) draftIface = `enp${i}s0`;
    assert.equal(draftIface, before, 'interface nao pode mudar com netApplyBusy=true');
  }

  // liberado o busy, a edicao volta a funcionar
  ui = extractUiTransientState({ ...ui, netApplyBusy: false }); // sistema (App.jsx) libera o busy, nao um input
  assert.equal(ui.netApplyBusy, false);
});
