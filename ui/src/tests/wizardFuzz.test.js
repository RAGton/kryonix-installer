import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_INSTALL_PLAN_DRAFT,
  INITIAL_UI_TRANSIENT_STATE,
  createInstallPlanDraft,
  extractUiTransientState,
  mergeWizardState,
  splitWizardPatch,
} from '../state/wizardState.js';
import { validateStep } from '../utils/installPlan.js';

// Fuzz determinístico: LCG semeado para que qualquer falha seja reproduzível
// (sem Math.random, que tornaria o CI flaky e o report inútil).
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Valores hostis cobrindo os edge cases da Matriz de Erros e Recuperação.
const HOSTILE_SCALARS = [
  0, -1, 1, 65535, 65536, 70000, 8080, 8080.5, NaN, Infinity, -Infinity,
  '', ' ', 'abc', '8080', '0x1F90', '8080; rm -rf /', '😀', '127.0.0.1',
  null, undefined, true, false, {}, [], '999.999.999.999', '::1',
  '192.168.0.1', '192.168.000.1', '10.0.0.0/24', 'A'.repeat(10000),
];

const STEP_IDS = [
  'welcome', 'eula', 'source', 'localization', 'timezone',
  'network', 'disks',
];

// ── Caso 8 da matriz: chaves fora da whitelist são descartadas ──────────────
test('fuzz: splitWizardPatch nunca vaza chaves desconhecidas nem polui o prototype', () => {
  const rng = makeRng(0xC0FFEE);
  for (let i = 0; i < 2000; i += 1) {
    const patch = {
      sourceKind: pick(rng, ['offline-defaults', 'github', 42, null]),
      netConnected: pick(rng, [true, false, 'sim', 0]),
      [`ghost_${Math.floor(rng() * 1e6)}`]: pick(rng, HOSTILE_SCALARS),
      constructor: 'evil',
      __proto__chain: pick(rng, HOSTILE_SCALARS),
    };
    const { draftPatch, uiPatch } = splitWizardPatch(patch);

    // Só campos whitelistados sobrevivem, em seus respectivos baldes.
    for (const k of Object.keys(draftPatch)) {
      assert.ok(k in INITIAL_INSTALL_PLAN_DRAFT, `draftPatch vazou chave: ${k}`);
    }
    for (const k of Object.keys(uiPatch)) {
      assert.ok(k in INITIAL_UI_TRANSIENT_STATE, `uiPatch vazou chave: ${k}`);
    }
    assert.equal('netConnected' in draftPatch, false);
    assert.equal('sourceKind' in uiPatch, false);
  }
});

test('fuzz: input hostil de localStorage (JSON com __proto__) não polui Object.prototype', () => {
  // readStoredWizardState faz JSON.parse de input não confiável; __proto__ via
  // JSON.parse é chave própria e é um vetor real de prototype pollution.
  const evil = JSON.parse('{"__proto__":{"polluted":true},"sourceKind":"github"}');
  const draft = createInstallPlanDraft(evil);
  const ui = extractUiTransientState(evil);
  assert.equal({}.polluted, undefined, 'Object.prototype foi poluído');
  assert.equal(draft.sourceKind, 'github');
  assert.equal('polluted' in draft, false);
  assert.equal('polluted' in ui, false);
});

// ── Casos 4 e 5 da matriz: porta e IPs sob fuzz, espelhando o contrato real ──
test('fuzz: validateStep(network) trata httpPort exatamente como o payload define', () => {
  const rng = makeRng(0x1234);
  for (let i = 0; i < 3000; i += 1) {
    const httpPort = pick(rng, HOSTILE_SCALARS);
    const draft = {
      ...INITIAL_INSTALL_PLAN_DRAFT,
      hostName: 'kryonix-e2e',
      mgmtInterface: 'eth0',
      mgmtMode: 'dhcp',
      wanInterface: '',
      httpPort,
    };
    const ui = { ...INITIAL_UI_TRANSIENT_STATE, netConnected: true };

    let result;
    assert.doesNotThrow(() => {
      result = validateStep('network', draft, ui);
    }, `validateStep lançou com httpPort=${JSON.stringify(httpPort)}`);

    // Espelha buildInstallPlanPayload + a checagem de faixa: porta inválida ⇒
    // erro de campo. Diferencial, não valor mágico.
    const n = Number.isFinite(Number(httpPort)) ? Number(httpPort) : 0;
    const expectedPortError = !(n >= 1 && n <= 65535);
    assert.equal(
      'httpPort' in result.fieldErrors,
      expectedPortError,
      `httpPort=${JSON.stringify(httpPort)} (n=${n}) divergiu do contrato`,
    );
  }
});

test('fuzz: validateStep(network) modo estático rejeita IP/gateway malformados', () => {
  const rng = makeRng(0xABCDEF);
  for (let i = 0; i < 3000; i += 1) {
    const draft = {
      ...INITIAL_INSTALL_PLAN_DRAFT,
      hostName: 'kryonix-e2e',
      mgmtInterface: 'eth0',
      mgmtMode: 'static',
      serverIp: pick(rng, HOSTILE_SCALARS),
      mgmtGateway: pick(rng, HOSTILE_SCALARS),
      mgmtNetmask: pick(rng, HOSTILE_SCALARS),
      mgmtDns: pick(rng, HOSTILE_SCALARS),
      httpPort: 8080,
    };
    const ui = { ...INITIAL_UI_TRANSIENT_STATE, netConnected: true };

    let result;
    assert.doesNotThrow(() => {
      result = validateStep('network', draft, ui);
    });
    // Se qualquer IP estático é inválido, o avanço deve estar bloqueado.
    const anyInvalid = ![draft.serverIp, draft.mgmtGateway, draft.mgmtNetmask]
      .every((v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(String(v)));
    if (anyInvalid) {
      assert.ok(
        result.blockingIssues.length > 0,
        'IP estático inválido não bloqueou o avanço',
      );
    }
  }
});

// ── Invariante de robustez: validateStep nunca explode, em nenhum step ───────
test('fuzz: validateStep nunca lança para drafts arbitrários em qualquer step', () => {
  const rng = makeRng(0x5EED);
  for (let i = 0; i < 4000; i += 1) {
    const draft = {};
    // Preenche um subconjunto aleatório de campos do draft com lixo.
    for (const key of Object.keys(INITIAL_INSTALL_PLAN_DRAFT)) {
      if (rng() < 0.6) draft[key] = pick(rng, HOSTILE_SCALARS);
    }
    const ui = {};
    for (const key of Object.keys(INITIAL_UI_TRANSIENT_STATE)) {
      if (rng() < 0.6) ui[key] = pick(rng, HOSTILE_SCALARS);
    }
    const stepId = pick(rng, STEP_IDS);
    assert.doesNotThrow(() => {
      const r = validateStep(stepId, draft, ui);
      // Shape invariante do resultado.
      assert.ok(Array.isArray(r.blockingIssues));
      assert.ok(Array.isArray(r.warnings));
      assert.equal(typeof r.fieldErrors, 'object');
    }, `step=${stepId} lançou com draft fuzzado (i=${i})`);
  }
});

// ── Estabilidade de round-trip do estado (persistência localStorage) ─────────
test('fuzz: mergeWizardState é estável sob re-split repetido', () => {
  const rng = makeRng(0xFADE);
  for (let i = 0; i < 1000; i += 1) {
    const seed = {};
    for (const key of Object.keys(INITIAL_INSTALL_PLAN_DRAFT)) {
      if (rng() < 0.5) seed[key] = pick(rng, HOSTILE_SCALARS);
    }
    for (const key of Object.keys(INITIAL_UI_TRANSIENT_STATE)) {
      if (rng() < 0.5) seed[key] = pick(rng, HOSTILE_SCALARS);
    }
    const merged1 = mergeWizardState(
      createInstallPlanDraft(seed),
      extractUiTransientState(seed),
    );
    const merged2 = mergeWizardState(
      createInstallPlanDraft(merged1),
      extractUiTransientState(merged1),
    );
    assert.deepEqual(merged2, merged1, 'round-trip de estado não é idempotente');
  }
});
