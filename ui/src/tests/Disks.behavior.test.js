import { test } from 'node:test';
import * as assert from 'node:assert';
import { evaluateManualPartitioningState } from '../utils/layoutAssistant.js';

function makeDisk(overrides = {}) {
  return {
    path: "/dev/nvme0n1",
    size_bytes: 512 * 1024 ** 3,
    model: "Test NVMe",
    ...overrides,
  };
}

function makePartition(overrides = {}) {
  return {
    id: "part-test",
    device: "/dev/nvme0n1",
    sizeBytes: 20 * 1024 ** 3,
    sizeInput: "20GiB",
    usage: "root",
    fstype: "btrfs",
    mountpoint: "/",
    label: "kryonix-root",
    format: true,
    ...overrides,
  };
}

test('Disco 0 B: bloqueia avanço, não habilita nova partição e mostra erro fatal', () => {
  const disk = makeDisk({ size_bytes: 0 });
  const parts = [];
  
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  
  assert.strictEqual(state.canCreatePartition, false);
  assert.strictEqual(state.isValid, false);
  assert.ok(state.diskValidations[0].errors.some(e => e.includes('indisponível')));
});

test('Alocação menor que o disco: botão Nova Partição habilitado, calcula espaço livre', () => {
  const disk = makeDisk({ size_bytes: 512 * 1024 ** 3 }); // 512 GiB
  const parts = [
    makePartition({ mountpoint: '/', sizeBytes: 20 * 1024 ** 3 }),
    makePartition({ usage: 'efi', fstype: 'fat32', mountpoint: '/boot/efi', sizeBytes: 2 * 1024 ** 3 }),
    makePartition({ usage: 'swap', fstype: 'swap', mountpoint: '', sizeBytes: 16 * 1024 ** 3 })
  ];
  
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  
  assert.strictEqual(state.canCreatePartition, true);
  assert.strictEqual(state.isValid, true);
  assert.ok(state.maxFree > 0);
  assert.strictEqual(state.diskValidations[0].allocatedBytes, 38 * 1024 ** 3);
});

test('Disco totalmente alocado: desabilita botão e emite warning', () => {
  const disk = makeDisk({ size_bytes: 38 * 1024 ** 3 }); 
  const parts = [
    makePartition({ mountpoint: '/', sizeBytes: 20 * 1024 ** 3 }),
    makePartition({ usage: 'efi', fstype: 'fat32', mountpoint: '/boot/efi', sizeBytes: 2 * 1024 ** 3 }),
    makePartition({ usage: 'swap', fstype: 'swap', mountpoint: '', sizeBytes: 16 * 1024 ** 3 })
  ];
  
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  
  assert.strictEqual(state.canCreatePartition, false);
  assert.strictEqual(state.isValid, true); // layout é válido, apenas está cheio
  assert.ok(state.warnings.some(w => w.includes('Totalmente') || w.includes('totalmente')));
});

test('Alocação excede o disco: mostra erro de excesso e bloqueia avanço', () => {
  const disk = makeDisk({ size_bytes: 30 * 1024 ** 3 }); 
  const parts = [
    makePartition({ mountpoint: '/', sizeBytes: 20 * 1024 ** 3 }),
    makePartition({ usage: 'efi', fstype: 'fat32', mountpoint: '/boot/efi', sizeBytes: 2 * 1024 ** 3 }),
    makePartition({ usage: 'swap', fstype: 'swap', mountpoint: '', sizeBytes: 16 * 1024 ** 3 })
  ]; // Total 38 GiB
  
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  
  assert.strictEqual(state.canCreatePartition, false);
  assert.strictEqual(state.isValid, false);
  assert.ok(state.validations.some(e => e.includes('excede')));
});

test('Swap não usa mountpoint: validação passa com string vazia', () => {
  const disk = makeDisk();
  const parts = [
    makePartition({ mountpoint: '/', sizeBytes: 20 * 1024 ** 3 }),
    makePartition({ usage: 'efi', fstype: 'fat32', mountpoint: '/boot/efi', sizeBytes: 2 * 1024 ** 3 }),
    makePartition({ usage: 'swap', fstype: 'swap', mountpoint: '', sizeBytes: 16 * 1024 ** 3, label: 'swappy' })
  ];
  
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  
  assert.strictEqual(state.isValid, true);
  const mps = parts.map(p => p.mountpoint).filter(Boolean);
  assert.strictEqual(mps.length, 2); // só / e /boot/efi
});

test('EFI válida: FAT32 e mountpoint correto em UEFI não dá erro', () => {
  const disk = makeDisk();
  const parts = [
    makePartition({ mountpoint: '/', sizeBytes: 20 * 1024 ** 3 }),
    makePartition({ usage: 'efi', fstype: 'fat32', mountpoint: '/boot/efi', sizeBytes: 2 * 1024 ** 3 }),
  ];
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  assert.strictEqual(state.isValid, true);
});

test('EFI inválida: ext4 ou btrfs dá erro de FAT32', () => {
  const disk = makeDisk();
  const parts = [
    makePartition({ mountpoint: '/', sizeBytes: 20 * 1024 ** 3 }),
    makePartition({ usage: 'efi', fstype: 'btrfs', mountpoint: '/boot/efi', sizeBytes: 2 * 1024 ** 3 }),
  ];
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  assert.strictEqual(state.isValid, false);
  assert.ok(state.validations.some(e => e.includes('FAT32')));
});

test('Root ausente: bloqueia avanço', () => {
  const disk = makeDisk();
  const parts = [
    makePartition({ usage: 'efi', fstype: 'fat32', mountpoint: '/boot/efi', sizeBytes: 2 * 1024 ** 3 }),
  ]; // Sem '/'
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  assert.strictEqual(state.isValid, false);
  assert.ok(state.validations.some(e => e.includes('root (/)')));
});

test('Labels duplicados: warning, não erro fatal', () => {
  const disk = makeDisk();
  const parts = [
    makePartition({ mountpoint: '/', label: 'duplicado' }),
    makePartition({ usage: 'data', mountpoint: '/mnt', label: 'duplicado' }),
    makePartition({ usage: 'efi', fstype: 'fat32', mountpoint: '/boot/efi', label: 'efi-ok' }),
  ];
  
  const state = evaluateManualPartitioningState([disk], parts, 'uefi');
  
  // Como a regra de label só avisa, isValid depende dos outros critérios
  assert.strictEqual(state.isValid, true);
  assert.ok(state.warnings.some(w => w.includes('duplicados')));
});
