// Assistente de layout de particionamento (lógica pura, sem React).
//
// Reaproveita formatBytes de storagePlanner (fonte única de formatação IEC).
//
// IMPORTANTE — limite de backend conhecido: o executor (src/executor/partition.rs)
// hoje só implementa `generate_btrfs_simple` (wipe → ESP 512M + btrfs 100%). Os
// presets "dual-boot"/"manual" produzem um PLANO visual/manualPartitions válido
// pelo schema, mas a aplicação real de layouts arbitrários / resize de partição
// existente é uma tarefa de backend separada. Não finja o contrário na UI.
import { formatBytes } from './storagePlanner.js';

const MiB = 1024 * 1024;
const GiB = MiB * 1024;

export const BOOT_PARTITION_BYTES = 512 * MiB; // ESP, igual ao disko (size="512M")
export const MIN_ROOT_BYTES = 20 * GiB;        // regra de prevenção de erro

export const PRESETS = [
  { id: 'kryonix-default', label: 'Kryonix Default', destructive: true,
    hint: 'Apaga tudo: Boot (512MB) + Root (restante).' },
  { id: 'dual-boot', label: 'Dual Boot', destructive: false,
    hint: 'Usa apenas o espaço livre existente. Resize automático não é suportado.' },
  { id: 'manual', label: 'Manual', destructive: false,
    hint: 'Abre a edição detalhada de partições.' },
];

export { formatBytes };

function toBytes(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseSizeInput(input, totalBytes, freeBytes) {
  if (!input) return 0;
  const str = String(input).trim().toLowerCase();
  if (str === 'resto' || str === 'restante') return Math.max(0, freeBytes);
  if (str.endsWith('%')) {
    const pct = parseFloat(str);
    if (Number.isNaN(pct)) return 0;
    return Math.floor(Math.max(0, Math.min(100, pct)) / 100 * totalBytes);
  }
  const match = str.match(/^([\d.]+)\s*(mib|gib|tib|mb|gb|tb)?$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  if (Number.isNaN(val)) return 0;
  const unit = match[2];
  if (unit === 'mib' || unit === 'mb') return Math.floor(val * MiB);
  if (unit === 'gib' || unit === 'gb') return Math.floor(val * GiB);
  if (unit === 'tib' || unit === 'tb') return Math.floor(val * GiB * 1024);
  return Math.floor(val);
}

export function bytesToPercent(bytes, totalBytes) {
  const total = toBytes(totalBytes);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (toBytes(bytes) / total) * 100));
}

// Partições existentes (vindas de lsblk -J children, quando o backend expuser).
// Cada partição: { name, sizeBytes, fstype?, label?, mountpoint? }.
function normalizePartitions(disk) {
  const list = Array.isArray(disk?.partitions) ? disk.partitions : [];
  return list
    .map((p) => ({
      name: String(p?.name || p?.path || '').trim(),
      sizeBytes: toBytes(p?.sizeBytes ?? p?.size_bytes ?? p?.size),
      fstype: String(p?.fstype || p?.fsType || '').trim(),
      label: String(p?.label || '').trim(),
    }))
    .filter((p) => p.sizeBytes > 0);
}

function usedBytes(partitions) {
  return partitions.reduce((t, p) => t + p.sizeBytes, 0);
}

// "Estado Atual": partições existentes + espaço livre restante.
export function buildCurrentBlocks(disk) {
  const total = toBytes(disk?.sizeBytes ?? disk?.size_bytes);
  const partitions = normalizePartitions(disk);
  const blocks = partitions.map((p) => ({
    kind: 'existing',
    label: p.label || p.name || 'Partição',
    detail: p.fstype || 'desconhecido',
    bytes: p.sizeBytes,
    percent: bytesToPercent(p.sizeBytes, total),
    sizeLabel: formatBytes(p.sizeBytes),
  }));
  const free = Math.max(0, total - usedBytes(partitions));
  if (free > 0) {
    blocks.push({
      kind: 'free', label: 'Espaço livre', detail: '',
      bytes: free, percent: bytesToPercent(free, total), sizeLabel: formatBytes(free),
    });
  }
  return blocks;
}

// "Estado Proposto" conforme o preset escolhido.
// Retorna { presetId, blocks, partitions, total, error }.
export function buildProposedLayout(disk, presetId) {
  const total = toBytes(disk?.sizeBytes ?? disk?.size_bytes);
  const device = String(disk?.path || disk?.name || '').trim();
  const existing = normalizePartitions(disk);

  if (presetId === 'manual') {
    return { presetId, blocks: [], partitions: [], total, manual: true, error: null };
  }

  if (presetId === 'kryonix-default') {
    const rootBytes = Math.max(0, total - BOOT_PARTITION_BYTES);
    const partitions = [
      { device, mountpoint: '/boot', fstype: 'vfat', sizeBytes: BOOT_PARTITION_BYTES, diskoSize: '512M' },
      { device, mountpoint: '/', fstype: 'btrfs', sizeBytes: rootBytes, diskoSize: '100%' },
    ];
    return {
      presetId, total, partitions, error: null,
      blocks: [
        block('boot', 'Boot (ESP)', 'vfat', BOOT_PARTITION_BYTES, total),
        block('new', 'Root Kryonix', 'btrfs', rootBytes, total),
      ],
    };
  }

  if (presetId === 'dual-boot') {
    const freeBytes = Math.max(0, total - usedBytes(existing));
    const needed = BOOT_PARTITION_BYTES + MIN_ROOT_BYTES;
    const blocks = existing.map((p) => block('existing', p.label || p.name, p.fstype, p.sizeBytes, total));

    if (freeBytes >= needed) {
      const rootBytes = freeBytes - BOOT_PARTITION_BYTES;
      blocks.push(block('boot', 'Boot (ESP)', 'vfat', BOOT_PARTITION_BYTES, total));
      blocks.push(block('new', 'Root Kryonix', 'btrfs', rootBytes, total));
      return {
        presetId, total, error: null, blocks,
        partitions: [
          { device, mountpoint: '/boot', fstype: 'vfat', sizeBytes: BOOT_PARTITION_BYTES, diskoSize: '512M' },
          { device, mountpoint: '/', fstype: 'btrfs', sizeBytes: rootBytes, diskoSize: `${Math.floor(rootBytes / MiB)}M` },
        ],
      };
    }

    // Sem espaço livre suficiente. O backend NÃO faz resize de partição existente
    // (não há shrink de NTFS/ext): não prometer redução automática.
    return {
      presetId, total, blocks, partitions: [],
      error: 'Dual boot manual: use partições já preparadas. Resize automático ainda não é suportado.',
    };
  }

  return { presetId, total, blocks: [], partitions: [], error: `Preset desconhecido: ${presetId}` };
}

function block(kind, label, detail, bytes, total) {
  return { kind, label, detail: detail || '', bytes, percent: bytesToPercent(bytes, total), sizeLabel: formatBytes(bytes) };
}

// Prevenção de erros (#4): bloqueia se root < 20GB ou sem partição de boot.
export function validateProposedLayout(layout) {
  const blockingReasons = [];
  if (!layout || layout.manual) {
    return { valid: false, blockingReasons: ['Layout manual ainda não definido.'] };
  }
  if (layout.error) {
    return { valid: false, blockingReasons: [layout.error] };
  }
  const parts = Array.isArray(layout.partitions) ? layout.partitions : [];
  const boot = parts.find((p) => p.mountpoint === '/boot' || p.mountpoint === '/boot/efi' || p.mountpoint === '/efi');
  const root = parts.find((p) => p.mountpoint === '/');

  if (!boot) blockingReasons.push('Nenhuma partição de boot (ESP) definida.');
  if (!root) {
    blockingReasons.push('Nenhuma partição root (/) definida.');
  } else if (root.sizeBytes < MIN_ROOT_BYTES) {
    blockingReasons.push(`Root tem ${formatBytes(root.sizeBytes)}; mínimo exigido é ${formatBytes(MIN_ROOT_BYTES)}.`);
  }
  return { valid: blockingReasons.length === 0, blockingReasons };
}

// Converte o layout proposto em manualPartitions do install-plan.schema.json:
// { device, mountpoint, fstype, size (string disko), format (bool) }.
export function toDiskoPartitions(layout) {
  if (!layout || !Array.isArray(layout.partitions)) return [];
  return layout.partitions.map((p) => ({
    device: p.device,
    mountpoint: p.mountpoint,
    fstype: p.fstype,
    size: p.diskoSize || `${Math.floor((p.sizeBytes || 0) / MiB)}M`,
    format: true,
  }));
}
