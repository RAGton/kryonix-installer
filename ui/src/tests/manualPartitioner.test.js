import { test } from 'node:test';
import * as assert from 'node:assert';
import { parseSizeInput, validateProposedLayout } from '../utils/layoutAssistant.js';

test('layoutAssistant - parseSizeInput: parses raw numbers correctly', () => {
  const MiB = 1024 * 1024;
  const GiB = MiB * 1024;
  const total = 100 * GiB;
  const free = 20 * GiB;
  assert.strictEqual(parseSizeInput('1000', total, free), 1000);
});

test('layoutAssistant - parseSizeInput: parses GiB, MiB correctly', () => {
  const MiB = 1024 * 1024;
  const GiB = MiB * 1024;
  const total = 100 * GiB;
  const free = 20 * GiB;
  assert.strictEqual(parseSizeInput('10GiB', total, free), 10 * GiB);
  assert.strictEqual(parseSizeInput('500MiB', total, free), 500 * MiB);
  assert.strictEqual(parseSizeInput('2.5GiB', total, free), Math.floor(2.5 * GiB));
});

test('layoutAssistant - parseSizeInput: parses percentages based on total', () => {
  const MiB = 1024 * 1024;
  const GiB = MiB * 1024;
  const total = 100 * GiB;
  const free = 20 * GiB;
  assert.strictEqual(parseSizeInput('10%', total, free), 10 * GiB);
  assert.strictEqual(parseSizeInput('50%', total, free), 50 * GiB);
});

test('layoutAssistant - parseSizeInput: parses resto / restante based on free bytes', () => {
  const MiB = 1024 * 1024;
  const GiB = MiB * 1024;
  const total = 100 * GiB;
  const free = 20 * GiB;
  assert.strictEqual(parseSizeInput('resto', total, free), free);
  assert.strictEqual(parseSizeInput('restante', total, free), free);
});

test('layoutAssistant - parseSizeInput: handles invalid inputs safely', () => {
  const MiB = 1024 * 1024;
  const GiB = MiB * 1024;
  const total = 100 * GiB;
  const free = 20 * GiB;
  assert.strictEqual(parseSizeInput('invalid', total, free), 0);
  assert.strictEqual(parseSizeInput('', total, free), 0);
  assert.strictEqual(parseSizeInput('-100', total, free), 0);
});

test('layoutAssistant - validateProposedLayout: fails if no root partition is defined', () => {
  const layout = {
    partitions: [
      { mountpoint: '/boot/efi', sizeBytes: 512 * 1024 * 1024 }
    ]
  };
  const result = validateProposedLayout(layout);
  assert.strictEqual(result.valid, false);
  assert.ok(result.blockingReasons.includes('Nenhuma partição root (/) definida.'));
});

test('layoutAssistant - validateProposedLayout: fails if root partition is too small', () => {
  const layout = {
    partitions: [
      { mountpoint: '/boot/efi', sizeBytes: 512 * 1024 * 1024 },
      { mountpoint: '/', sizeBytes: 10 * 1024 * 1024 * 1024 } // 10GiB < 20GiB
    ]
  };
  const result = validateProposedLayout(layout);
  assert.strictEqual(result.valid, false);
  assert.ok(/mínimo exigido/.test(result.blockingReasons[0]));
});

test('layoutAssistant - validateProposedLayout: passes for valid layouts', () => {
  const layout = {
    partitions: [
      { mountpoint: '/boot/efi', sizeBytes: 512 * 1024 * 1024 },
      { mountpoint: '/', sizeBytes: 25 * 1024 * 1024 * 1024 } // 25GiB
    ]
  };
  const result = validateProposedLayout(layout);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blockingReasons.length, 0);
});
