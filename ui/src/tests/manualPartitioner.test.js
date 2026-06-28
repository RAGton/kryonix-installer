import { describe, it, expect } from 'vitest';
import { parseSizeInput, validateProposedLayout } from '../utils/layoutAssistant.js';

describe('layoutAssistant - parseSizeInput', () => {
  const MiB = 1024 * 1024;
  const GiB = MiB * 1024;
  const total = 100 * GiB;
  const free = 20 * GiB;

  it('parses raw numbers correctly', () => {
    expect(parseSizeInput('1000', total, free)).toBe(1000);
  });

  it('parses GiB, MiB correctly', () => {
    expect(parseSizeInput('10GiB', total, free)).toBe(10 * GiB);
    expect(parseSizeInput('500MiB', total, free)).toBe(500 * MiB);
    expect(parseSizeInput('2.5GiB', total, free)).toBe(Math.floor(2.5 * GiB));
  });

  it('parses percentages based on total', () => {
    expect(parseSizeInput('10%', total, free)).toBe(10 * GiB);
    expect(parseSizeInput('50%', total, free)).toBe(50 * GiB);
  });

  it('parses resto / restante based on free bytes', () => {
    expect(parseSizeInput('resto', total, free)).toBe(free);
    expect(parseSizeInput('restante', total, free)).toBe(free);
  });

  it('handles invalid inputs safely', () => {
    expect(parseSizeInput('invalid', total, free)).toBe(0);
    expect(parseSizeInput('', total, free)).toBe(0);
    expect(parseSizeInput('-100', total, free)).toBe(0);
  });
});

describe('layoutAssistant - validateProposedLayout', () => {
  it('fails if no root partition is defined', () => {
    const layout = {
      partitions: [
        { mountpoint: '/boot/efi', sizeBytes: 512 * 1024 * 1024 }
      ]
    };
    const result = validateProposedLayout(layout);
    expect(result.valid).toBe(false);
    expect(result.blockingReasons).toContain('Nenhuma partição root (/) definida.');
  });

  it('fails if root partition is too small', () => {
    const layout = {
      partitions: [
        { mountpoint: '/boot/efi', sizeBytes: 512 * 1024 * 1024 },
        { mountpoint: '/', sizeBytes: 10 * 1024 * 1024 * 1024 } // 10GiB < 20GiB
      ]
    };
    const result = validateProposedLayout(layout);
    expect(result.valid).toBe(false);
    expect(result.blockingReasons[0]).toMatch(/mínimo exigido/);
  });

  it('passes for valid layouts', () => {
    const layout = {
      partitions: [
        { mountpoint: '/boot/efi', sizeBytes: 512 * 1024 * 1024 },
        { mountpoint: '/', sizeBytes: 25 * 1024 * 1024 * 1024 } // 25GiB
      ]
    };
    const result = validateProposedLayout(layout);
    expect(result.valid).toBe(true);
    expect(result.blockingReasons.length).toBe(0);
  });
});
