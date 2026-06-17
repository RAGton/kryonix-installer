import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOT_PARTITION_BYTES,
  MIN_ROOT_BYTES,
  bytesToPercent,
  buildCurrentBlocks,
  buildProposedLayout,
  validateProposedLayout,
  toDiskoPartitions,
} from '../utils/layoutAssistant.js';

const GB = 1000 * 1000 * 1000; // decimal (como lsblk reporta capacidade nominal)
const MiB = 1024 * 1024;

// Mock data exigido: SSD 512GB com Windows + HDD 1TB vazio.
const SSD_WINDOWS = {
  path: '/dev/sda', name: 'sda', model: 'Samsung SSD 512GB', sizeBytes: 512 * GB,
  partitions: [
    { name: 'sda1', sizeBytes: 512 * MiB, fstype: 'vfat', label: 'EFI' },
    { name: 'sda2', sizeBytes: 400 * GB, fstype: 'ntfs', label: 'Windows' },
  ],
};
const HDD_EMPTY = {
  path: '/dev/sdb', name: 'sdb', model: 'Seagate 1TB', sizeBytes: 1000 * GB, partitions: [],
};

test('bytesToPercent: clampa e protege total zero', () => {
  assert.equal(bytesToPercent(50, 100), 50);
  assert.equal(bytesToPercent(200, 100), 100);
  assert.equal(bytesToPercent(10, 0), 0);
  assert.equal(bytesToPercent(-5, 100), 0);
});

test('buildCurrentBlocks: SSD com Windows mostra existentes + espaço livre, somando ~100%', () => {
  const blocks = buildCurrentBlocks(SSD_WINDOWS);
  assert.ok(blocks.some((b) => b.kind === 'existing' && b.label === 'Windows'));
  assert.ok(blocks.some((b) => b.kind === 'free'));
  const sum = blocks.reduce((t, b) => t + b.percent, 0);
  assert.ok(Math.abs(sum - 100) < 0.01, `soma de percent = ${sum}`);
});

test('buildCurrentBlocks: HDD vazio é 100% espaço livre', () => {
  const blocks = buildCurrentBlocks(HDD_EMPTY);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'free');
  assert.ok(Math.abs(blocks[0].percent - 100) < 0.01);
});

test('kryonix-default: boot 512M + root restante, válido em disco grande', () => {
  const layout = buildProposedLayout(HDD_EMPTY, 'kryonix-default');
  const boot = layout.partitions.find((p) => p.mountpoint === '/boot');
  const root = layout.partitions.find((p) => p.mountpoint === '/');
  assert.equal(boot.sizeBytes, BOOT_PARTITION_BYTES);
  assert.equal(root.sizeBytes, 1000 * GB - BOOT_PARTITION_BYTES);
  assert.equal(validateProposedLayout(layout).valid, true);
});

test('prevenção de erro: root < 20GB é bloqueado', () => {
  const tiny = { path: '/dev/sdc', name: 'sdc', sizeBytes: 10 * (1024 ** 3), partitions: [] };
  const layout = buildProposedLayout(tiny, 'kryonix-default');
  const v = validateProposedLayout(layout);
  assert.equal(v.valid, false);
  assert.ok(v.blockingReasons.some((r) => /mínimo/i.test(r)));
});

test('prevenção de erro: layout sem boot é bloqueado', () => {
  const fake = { partitions: [{ device: '/dev/sda', mountpoint: '/', fstype: 'btrfs', sizeBytes: 100 * (1024 ** 3) }], total: 100 * GB };
  const v = validateProposedLayout(fake);
  assert.equal(v.valid, false);
  assert.ok(v.blockingReasons.some((r) => /boot/i.test(r)));
});

test('toDiskoPartitions: shape do schema (size string, format bool)', () => {
  const layout = buildProposedLayout(HDD_EMPTY, 'kryonix-default');
  const parts = toDiskoPartitions(layout);
  for (const p of parts) {
    assert.equal(typeof p.device, 'string');
    assert.equal(typeof p.mountpoint, 'string');
    assert.equal(typeof p.size, 'string');
    assert.equal(p.format, true);
  }
  assert.equal(parts.find((p) => p.mountpoint === '/boot').size, '512M');
  assert.equal(parts.find((p) => p.mountpoint === '/').size, '100%');
});

test('dual-boot: SSD sem espaço livre suficiente sinaliza resize ou erro (nunca finge sucesso)', () => {
  const layout = buildProposedLayout(SSD_WINDOWS, 'dual-boot');
  // free = 512GB - (512MiB + 400GB) ≈ 111GB > 20GB+512MiB → cabe no espaço livre.
  // Então deve propor boot+root no espaço livre, válido.
  assert.equal(layout.error, null);
  const v = validateProposedLayout(layout);
  assert.equal(v.valid, true);
});

test('dual-boot: disco cheio (sem espaço livre) recusa sem prometer resize', () => {
  const full = {
    path: '/dev/sdd', name: 'sdd', sizeBytes: 256 * GB,
    partitions: [{ name: 'sdd1', sizeBytes: 255 * GB, fstype: 'ntfs', label: 'Windows' }],
  };
  const layout = buildProposedLayout(full, 'dual-boot');
  assert.equal(layout.requiresResize, undefined);
  assert.ok(/não é suportado/i.test(layout.error), `mensagem honesta esperada, veio: ${layout.error}`);
  assert.equal(validateProposedLayout(layout).valid, false);
});

test('manual: marca layout manual e é inválido até definição', () => {
  const layout = buildProposedLayout(HDD_EMPTY, 'manual');
  assert.equal(layout.manual, true);
  assert.equal(validateProposedLayout(layout).valid, false);
});
