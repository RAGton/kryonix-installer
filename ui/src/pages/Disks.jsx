import { useEffect, useMemo, useState } from 'react';
import { installerApi, getInstallerApiErrorMessage } from '../utils/installerApi.js';
import {
  formatBytes,
  normalizeDiskInventory,
  shouldRecommendSrvData,
  validateSingleDiskLayout,
} from '../utils/storagePlanner.js';

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

function arraysEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function uniqueStrings(items) {
  return Array.from(new Set((Array.isArray(items) ? items : []).filter(Boolean)));
}

function diskSizeBytes(disk) {
  return Number(disk?.sizeBytes ?? disk?.size_bytes ?? disk?.logical_size ?? disk?.size ?? 0) || 0;
}

function diskLabel(disk) {
  return disk?.path || (disk?.name ? `/dev/${disk.name}` : 'Disco');
}

function diskPartKey(disk) {
  return disk?.name || disk?.path?.split('/').pop() || '';
}

function parseManualSizeToBytes(size, diskBytes) {
  const raw = String(size || '').trim().toLowerCase();
  if (!raw) return 0;
  if (raw === '100%' || raw === 'restante') return Math.max(diskBytes - 512 * MiB, 0);

  const match = raw.match(/^(\d+(?:\.\d+)?)(m|mb|g|gb|t|tb)?$/);
  if (!match) return 0;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2] || 'g';
  if (unit === 'm' || unit === 'mb') return value * MiB;
  if (unit === 't' || unit === 'tb') return value * 1024 * GiB;
  return value * GiB;
}

function partitionKind(part) {
  const mount = String(part.mountpoint || '').toLowerCase();
  const fs = String(part.fstype || '').toLowerCase();
  const label = String(part.label || part.name || '').toLowerCase();

  if (mount === '/boot/efi' || mount === '/efi' || fs === 'vfat' || label.includes('efi')) return 'efi';
  if (mount === '/' || mount === '/root') return 'root';
  if (mount === '/home') return 'home';
  if (fs === 'swap') return 'swap';
  if (fs === 'ntfs') return 'ntfs';
  if (mount.startsWith('/srv') || mount.startsWith('/data')) return 'data';
  if (part.kind === 'free') return 'free';
  return 'other';
}

function partName(part) {
  return part.mountpoint || part.label || part.name || part.fstype || 'partição';
}

function normalizeCurrentPartitions(partitions) {
  return (Array.isArray(partitions) ? partitions : []).map((part) => ({
    name: part.name || part.path || 'partição',
    label: part.label || part.mountpoint || part.fstype || 'existente',
    mountpoint: part.mountpoint || '',
    fstype: part.fstype || '',
    sizeBytes: Number(part.sizeBytes ?? part.size_bytes ?? part.size ?? 0) || 0,
  }));
}

function buildRecommendedPlan(disk, wizard) {
  const total = diskSizeBytes(disk);
  if (!disk || total <= 0) return [];

  const efi = Math.min(512 * MiB, Math.max(total * 0.02, 128 * MiB));
  const root = Math.max(total - efi, 0);
  const enableSrvData = shouldRecommendSrvData(wizard.profileId, wizard.selectedFeatures);

  return [
    {
      label: 'EFI',
      mountpoint: '/boot/efi',
      fstype: 'vfat',
      sizeBytes: efi,
      detail: 'Partição de boot UEFI',
      kind: 'efi',
    },
    {
      label: enableSrvData ? 'Sistema + dados' : 'Sistema',
      mountpoint: '/',
      fstype: 'btrfs',
      sizeBytes: root,
      detail: enableSrvData
        ? 'Subvolumes @, @home, @nix, @log e @srv/data'
        : 'Subvolumes @, @home, @nix e @log',
      kind: 'root',
    },
  ];
}

function buildManualPlan(manualParts, selectedDisk) {
  const total = diskSizeBytes(selectedDisk);
  return (Array.isArray(manualParts) ? manualParts : [])
    .filter((part) => part.device === diskLabel(selectedDisk))
    .map((part) => ({
      label: part.mountpoint || part.fstype,
      mountpoint: part.mountpoint,
      fstype: part.fstype,
      sizeBytes: parseManualSizeToBytes(part.size, total),
      detail: part.format ? 'formatar' : 'preservar',
      kind: partitionKind(part),
    }));
}

function validateManualPartitions(parts, selectedDisk) {
  const issues = [];
  const warnings = [];
  const manual = Array.isArray(parts) ? parts : [];
  const selectedPath = diskLabel(selectedDisk);
  const mountpoints = manual.map((part) => String(part.mountpoint || '').trim()).filter(Boolean);
  const duplicateMountpoints = mountpoints.filter((mount, index) => mountpoints.indexOf(mount) !== index);
  const root = manual.some((part) => part.mountpoint === '/');
  const efi = manual.some((part) => part.mountpoint === '/boot/efi' || part.mountpoint === '/efi');
  const totalManualBytes = manual
    .filter((part) => part.device === selectedPath)
    .reduce((sum, part) => sum + parseManualSizeToBytes(part.size, diskSizeBytes(selectedDisk)), 0);

  if (!root) issues.push('Modo manual exige partição raiz (/).');
  if (!efi) issues.push('Modo manual exige partição EFI (/boot/efi ou /efi).');
  for (const mountpoint of uniqueStrings(duplicateMountpoints)) {
    issues.push(`Ponto de montagem duplicado: ${mountpoint}.`);
  }
  for (const part of manual) {
    if (!part.device || !part.mountpoint || !part.fstype || !part.size) {
      issues.push('Todas as partições manuais precisam de disco, montagem, filesystem e tamanho.');
      break;
    }
  }
  if (totalManualBytes > diskSizeBytes(selectedDisk) && diskSizeBytes(selectedDisk) > 0) {
    issues.push('A soma das partições manuais excede a capacidade do disco selecionado.');
  }
  if (manual.some((part) => part.device !== selectedPath)) {
    warnings.push('Há partições manuais em outro disco; o preview mostra apenas o disco selecionado.');
  }

  return { valid: issues.length === 0, issues, warnings };
}

function PartitionBar({ title, subtitle, parts, totalBytes, emptyLabel, showPct = true }) {
  const total = Number(totalBytes) || parts.reduce((sum, part) => sum + Number(part.sizeBytes || 0), 0);
  const normalized = parts.filter((part) => Number(part.sizeBytes || 0) > 0);

  return (
    <div className="partition-block">
      <div className="partition-block-header">
        <div>
          <div className="partition-block-title">{title}</div>
          {subtitle ? <div className="partition-block-subtitle">{subtitle}</div> : null}
        </div>
      </div>
      <div className="partition-bar" role="img" aria-label={`${title}: ${normalized.map(p => `${partName(p)} ${formatBytes(p.sizeBytes)}`).join(', ')}`}>
        {normalized.length === 0 ? (
          <div className="partition-seg partition-free partition-empty" title={emptyLabel}>
            {emptyLabel}
          </div>
        ) : normalized.map((part, index) => {
          const pct = total > 0 ? Math.max((Number(part.sizeBytes || 0) / total) * 100, 0.5) : 0.5;
          const kind = part.kind || partitionKind(part);
          return (
            <div
              key={`${partName(part)}-${index}`}
              className={`partition-seg partition-${kind}`}
              style={{ flex: `${pct} 0 0` }}
              title={`${partName(part)} · ${formatBytes(part.sizeBytes)} · ${part.fstype || 'fs'}`}
            >
              {showPct && pct >= 8 ? (
                <span className="partition-seg-label">{partName(part)} · {formatBytes(part.sizeBytes)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
      {normalized.length > 0 ? (
        <div className="partition-legend">
          {normalized.map((part, index) => (
            <div key={`${partName(part)}-legend-${index}`} className="legend-item">
              <div className={`legend-dot partition-${part.kind || partitionKind(part)}`} />
              <span>{partName(part)} · {formatBytes(part.sizeBytes)} · {part.fstype || 'fs'}</span>
              {part.detail ? <span className="legend-detail">({part.detail})</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DiskCard({ disk, selected, onSelect }) {
  const blocked = disk.eligible === false;
  const reason = Array.isArray(disk.eligibilityIssues) ? disk.eligibilityIssues[0] : '';

  return (
    <button
      type="button"
      className={`disk-card${selected ? ' selected' : ''}${blocked ? ' blocked' : ''}`}
      disabled={blocked}
      onClick={onSelect}
    >
      <div className="disk-card-main">
        <div className="disk-card-info">
          <div className="disk-card-name-row">
            <span className="disk-card-name">{diskLabel(disk)}</span>
            {disk === selected && !blocked ? <span className="disk-badge recommended">recomendado</span> : null}
            {blocked ? <span className="disk-badge danger">bloqueado</span> : null}
          </div>
          <div className="disk-card-meta">
            {disk.model || 'Modelo desconhecido'} · {disk.type || 'disk'} · {formatBytes(diskSizeBytes(disk))}
          </div>
        </div>
        <div className="disk-card-radio" aria-hidden="true">{selected ? '●' : '○'}</div>
      </div>
      {reason ? <div className="disk-card-warning">{reason}</div> : null}
    </button>
  );
}

function ManualPartitionModal({ onClose, onSave, initialData, selectedDisk }) {
  const [formData, setFormData] = useState(initialData || {
    device: diskLabel(selectedDisk),
    mountpoint: '',
    fstype: 'btrfs',
    size: '100%',
    format: true,
  });

  const isValid = formData.device && formData.mountpoint && formData.fstype && formData.size;

  const mountpointOptions = [
    { value: '/', label: '/ (raiz)' },
    { value: '/home', label: '/home' },
    { value: '/boot/efi', label: '/boot/efi (EFI)' },
    { value: '/efi', label: '/efi (EFI alternativo)' },
    { value: '/var', label: '/var' },
    { value: '/nix', label: '/nix' },
    { value: '/srv/data', label: '/srv/data' },
  ];

  const fstypeOptions = [
    { value: 'btrfs', label: 'btrfs' },
    { value: 'ext4', label: 'ext4' },
    { value: 'xfs', label: 'xfs' },
    { value: 'vfat', label: 'vfat (EFI)' },
    { value: 'swap', label: 'swap' },
    { value: 'ntfs', label: 'ntfs' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content glass-panel disk-partition-modal" onClick={(event) => event.stopPropagation()}>
        <h3 id="modal-title" className="modal-title">{initialData ? 'Editar partição' : 'Nova partição'}</h3>

        <div className="form-group">
          <label htmlFor="mp-device">Disco</label>
          <input id="mp-device" className="input-shell" value={formData.device} disabled />
        </div>

        <div className="form-group">
          <label htmlFor="mp-mountpoint">Ponto de montagem</label>
          <select
            id="mp-mountpoint"
            value={formData.mountpoint}
            onChange={(event) => setFormData({ ...formData, mountpoint: event.target.value })}
            className="input-shell"
          >
            <option value="">Selecione…</option>
            {mountpointOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="mp-fstype">Filesystem</label>
            <select
              id="mp-fstype"
              value={formData.fstype}
              onChange={(event) => setFormData({ ...formData, fstype: event.target.value })}
              className="input-shell"
            >
              {fstypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="mp-size">Tamanho</label>
            <input
              id="mp-size"
              type="text"
              placeholder="512M, 40G, 100%"
              value={formData.size}
              onChange={(event) => setFormData({ ...formData, size: event.target.value })}
              className="input-shell"
            />
          </div>
        </div>

        <label className="manual-format-toggle">
          <input
            type="checkbox"
            checked={formData.format}
            onChange={(event) => setFormData({ ...formData, format: event.target.checked })}
          />
          <span>Formatar esta partição</span>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!isValid} onClick={() => onSave(formData)}>
            {initialData ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualDrawer({ wizard, selectedDisk, manualValidation, onChange, onClose, onUseRecommended }) {
  const [modalIndex, setModalIndex] = useState(null);
  const manualParts = Array.isArray(wizard.manualPartitions) ? wizard.manualPartitions : [];
  const selectedPath = diskLabel(selectedDisk);
  const previewParts = buildManualPlan(manualParts, selectedDisk);

  function upsertPartition(part) {
    const next = [...manualParts];
    if (Number.isInteger(modalIndex) && modalIndex >= 0) {
      next[modalIndex] = part;
    } else {
      next.push(part);
    }
    onChange({
      diskProfile: 'manual',
      diskMode: 'one',
      sysDisk: selectedPath,
      dataDisk: '',
      selectedDisks: uniqueStrings([selectedPath, ...next.map((item) => item.device)]),
      manualPartitions: next,
    });
    setModalIndex(null);
  }

  function removePartition(index) {
    const next = manualParts.filter((_, current) => current !== index);
    onChange({
      diskProfile: next.length > 0 ? 'manual' : 'single',
      diskMode: 'one',
      sysDisk: selectedPath,
      dataDisk: '',
      selectedDisks: [selectedPath],
      manualPartitions: next,
    });
  }

  const hasIssues = manualValidation.issues.length > 0;
  const hasWarnings = manualValidation.warnings.length > 0;

  return (
    <div className="manual-drawer-overlay" role="dialog" aria-modal="true">
      <div className="manual-drawer">
        <header className="manual-drawer-header">
          <div>
            <div className="eyebrow">Modo avançado</div>
            <h3>Particionamento manual</h3>
            <p>Defina as partições que serão criadas. O preview abaixo atualiza em tempo real.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>Fechar</button>
        </header>

        <div className="manual-drawer-body">
          <div className="manual-drawer-preview">
            <PartitionBar
              title="Preview do plano manual"
              subtitle={manualParts.length > 0 ? `${manualParts.length} partição(ões) definida(s)` : 'Nenhuma partição — adicione pelo menos / e /boot/efi'}
              parts={previewParts}
              totalBytes={diskSizeBytes(selectedDisk)}
              emptyLabel="vazio — adicione partições"
            />
          </div>

          <div className="manual-drawer-actions">
            <button type="button" className="btn-primary" onClick={() => setModalIndex(-1)}>
              Nova partição
            </button>
            <button type="button" className="btn-secondary" onClick={onUseRecommended}>
              Restaurar recomendado
            </button>
          </div>

          <div className="manual-table-wrapper">
            <table className="manual-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Montagem</th>
                  <th>FS</th>
                  <th>Tamanho</th>
                  <th>Formato</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {manualParts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="manual-empty">
                      Nenhuma partição manual. Adicione pelo menos <code>/</code> e <code>/boot/efi</code>.
                    </td>
                  </tr>
                ) : manualParts.map((part, index) => (
                  <tr key={`${part.device}-${part.mountpoint}-${index}`}>
                    <td><span className="part-index">{index + 1}</span></td>
                    <td><code className="code-pill">{part.mountpoint}</code></td>
                    <td>{part.fstype}</td>
                    <td>{part.size}</td>
                    <td>{part.format ? 'formatar' : 'preservar'}</td>
                    <td>
                      <div className="manual-row-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          title="Editar partição"
                          onClick={() => setModalIndex(index)}
                          aria-label={`Editar partição ${part.mountpoint}`}
                        >
                          E
                        </button>
                        <button
                          type="button"
                          className="btn-icon danger"
                          title="Remover partição"
                          onClick={() => removePartition(index)}
                          aria-label={`Remover partição ${part.mountpoint}`}
                        >
                          X
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`manual-validation ${hasIssues ? 'has-issues' : ''}`}>
            {manualValidation.issues.map((issue) => (
              <div key={issue} className="validation-item danger" role="alert">
                <span className="validation-icon" aria-hidden="true">✕</span>
                {issue}
              </div>
            ))}
            {manualValidation.warnings.map((warning) => (
              <div key={warning} className="validation-item warning">
                <span className="validation-icon" aria-hidden="true">⚠</span>
                {warning}
              </div>
            ))}
            {!hasIssues && !hasWarnings && manualParts.length > 0 && (
              <div className="validation-item ok">
                <span className="validation-icon" aria-hidden="true">✓</span>
                Plano manual válido — pronto para validação final no dry-run.
              </div>
            )}
            {!hasIssues && !hasWarnings && manualParts.length === 0 && (
              <div className="validation-item info">
                <span className="validation-icon" aria-hidden="true">ℹ</span>
                Adicione partições para validar o plano.
              </div>
            )}
          </div>
        </div>

        {modalIndex !== null ? (
          <ManualPartitionModal
            selectedDisk={selectedDisk}
            initialData={modalIndex >= 0 ? manualParts[modalIndex] : null}
            onClose={() => setModalIndex(null)}
            onSave={upsertPartition}
          />
        ) : null}
      </div>
    </div>
  );
}

function RecommendedLayoutCard({ selectedDisk, wizard, isManualMode }) {
  const enableSrvData = shouldRecommendSrvData(wizard.profileId, wizard.selectedFeatures);
  const plan = buildRecommendedPlan(selectedDisk, wizard);

  if (isManualMode) {
    return (
      <div className="layout-card manual-mode">
        <div className="layout-card-header">
          <h3>Plano manual ativo</h3>
          <span className="layout-badge manual">manual</span>
        </div>
        <p>Você está revisando um plano avançado. O backend fará dry-run antes da instalação.</p>
      </div>
    );
  }

  return (
    <div className="layout-card recommended">
      <div className="layout-card-header">
        <h3>Layout recomendado pelo Kryonix</h3>
        <span className="layout-badge auto">automático</span>
      </div>
      <p className="layout-desc">
        O instalador criará uma partição EFI e uma raiz Btrfs ocupando o restante do disco.
        Subvolumes são gerenciados automaticamente dentro do volume raiz.
      </p>
      <div className="layout-parts">
        {plan.map((part, index) => (
          <div key={index} className={`layout-part layout-part-${part.kind}`}>
            <div className="layout-part-icon" aria-hidden="true">
              {part.kind === 'efi' ? '⏻' : '💾'}
            </div>
            <div className="layout-part-info">
              <div className="layout-part-name">{part.label}</div>
              <div className="layout-part-detail">
                {part.mountpoint} · {formatBytes(part.sizeBytes)} · {part.fstype}
              </div>
              <div className="layout-part-subdetail">{part.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="layout-tags">
        <span className="layout-tag">GPT</span>
        <span className="layout-tag">UEFI</span>
        <span className="layout-tag">Btrfs</span>
        <span className="layout-tag destructive">destrutivo</span>
        {enableSrvData ? <span className="layout-tag">/srv/data como subvolume</span> : <span className="layout-tag muted">/srv/data desativado</span>}
      </div>
    </div>
  );
}

export default function Disks({ wizard, uiState, onChange }) {
  const [diskInventory, setDiskInventory] = useState([]);
  const [partitionsByDisk, setPartitionsByDisk] = useState({});
  const [loadingDisks, setLoadingDisks] = useState(true);
  const [diskError, setDiskError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingDisks(true);
    setDiskError('');

    installerApi.getDisks()
      .then((disks) => {
        if (!cancelled) setDiskInventory(normalizeDiskInventory(disks));
      })
      .catch((error) => {
        if (!cancelled) {
          setDiskError(getInstallerApiErrorMessage(error, 'Erro ao carregar discos.'));
          setDiskInventory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDisks(false);
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (diskInventory.length === 0) return undefined;
    let cancelled = false;

    for (const disk of diskInventory) {
      const key = diskPartKey(disk);
      if (!key) continue;

      installerApi.getDiskPartitions(key)
        .then((parts) => {
          if (!cancelled) setPartitionsByDisk((previous) => ({ ...previous, [key]: normalizeCurrentPartitions(parts) }));
        })
        .catch(() => {
          if (!cancelled) setPartitionsByDisk((previous) => ({ ...previous, [key]: [] }));
        });
    }

    return () => { cancelled = true; };
  }, [diskInventory]);

  const eligibleDisks = useMemo(() => diskInventory.filter((disk) => disk.eligible), [diskInventory]);
  const eligiblePaths = useMemo(() => new Set(eligibleDisks.map((disk) => disk.path)), [eligibleDisks]);
  const selectedPath = eligiblePaths.has(wizard.sysDisk) ? wizard.sysDisk : eligibleDisks[0]?.path || '';
  const selectedDisk = useMemo(
    () => eligibleDisks.find((disk) => disk.path === selectedPath) || null,
    [eligibleDisks, selectedPath],
  );
  const selectedPartitions = selectedDisk ? partitionsByDisk[diskPartKey(selectedDisk)] || [] : [];
  const recommendedPlan = useMemo(() => buildRecommendedPlan(selectedDisk, wizard), [selectedDisk, wizard]);
  const manualPlan = useMemo(() => buildManualPlan(wizard.manualPartitions, selectedDisk), [wizard.manualPartitions, selectedDisk]);
  const manualValidation = useMemo(
    () => validateManualPartitions(wizard.manualPartitions, selectedDisk),
    [wizard.manualPartitions, selectedDisk],
  );
  const isManualMode = wizard.diskProfile === 'manual';
  const activePlan = isManualMode ? manualPlan : recommendedPlan;
  const activeValidation = isManualMode
    ? { blockingReasons: manualValidation.issues, warnings: manualValidation.warnings }
    : validateSingleDiskLayout(diskInventory, selectedPath);
  const enableSrvData = shouldRecommendSrvData(wizard.profileId, wizard.selectedFeatures);

  useEffect(() => {
    if (loadingDisks) return;
    const patch = {};

    if (selectedPath && wizard.sysDisk !== selectedPath) patch.sysDisk = selectedPath;
    if (!isManualMode && wizard.diskProfile !== 'single') patch.diskProfile = 'single';
    if (wizard.diskMode !== 'one') patch.diskMode = 'one';
    if (wizard.dataDisk) patch.dataDisk = '';
    if (!isManualMode && !arraysEqual(wizard.selectedDisks || [], selectedPath ? [selectedPath] : [])) {
      patch.selectedDisks = selectedPath ? [selectedPath] : [];
    }
    if (!isManualMode && wizard.rootFs !== 'btrfs') patch.rootFs = 'btrfs';
    if (!isManualMode && wizard.dataFs !== 'btrfs') patch.dataFs = 'btrfs';

    const storageIssues = activeValidation.blockingReasons || [];
    const storageWarnings = activeValidation.warnings || [];
    if (!arraysEqual(storageIssues, uiState.storageBlockingIssues || [])) patch.storageBlockingIssues = storageIssues;
    if (!arraysEqual(storageWarnings, uiState.storageWarnings || [])) patch.storageWarnings = storageWarnings;

    if (Object.keys(patch).length > 0) onChange(patch);
  }, [
    activeValidation.blockingReasons,
    activeValidation.warnings,
    isManualMode,
    loadingDisks,
    onChange,
    selectedPath,
    uiState.storageBlockingIssues,
    uiState.storageWarnings,
    wizard.dataDisk,
    wizard.dataFs,
    wizard.diskMode,
    wizard.diskProfile,
    wizard.rootFs,
    wizard.selectedDisks,
    wizard.sysDisk,
  ]);

  function selectDisk(path) {
    if (!eligiblePaths.has(path)) return;
    onChange({
      diskProfile: 'single',
      diskMode: 'one',
      sysDisk: path,
      dataDisk: '',
      selectedDisks: [path],
      rootFs: 'btrfs',
      dataFs: 'btrfs',
      manualPartitions: [],
    });
  }

  function useRecommended() {
    if (!selectedPath) return;
    onChange({
      diskProfile: 'single',
      diskMode: 'one',
      sysDisk: selectedPath,
      dataDisk: '',
      selectedDisks: [selectedPath],
      rootFs: 'btrfs',
      dataFs: 'btrfs',
      manualPartitions: [],
    });
    setManualOpen(false);
  }

  function openManual() {
    if (!selectedDisk) return;
    const initialManual = Array.isArray(wizard.manualPartitions) && wizard.manualPartitions.length > 0
      ? wizard.manualPartitions
      : [
        { device: selectedPath, mountpoint: '/boot/efi', fstype: 'vfat', size: '512M', format: true },
        { device: selectedPath, mountpoint: '/', fstype: 'btrfs', size: '100%', format: true },
      ];

    onChange({
      diskProfile: 'manual',
      diskMode: 'one',
      sysDisk: selectedPath,
      dataDisk: '',
      selectedDisks: [selectedPath],
      manualPartitions: initialManual,
    });
    setManualOpen(true);
  }

  const blockedDisks = diskInventory.filter((disk) => !disk.eligible);

  return (
    <div className="disk-cockpit">
      <header className="disk-cockpit-header">
        <div>
          <div className="eyebrow">Configuração de armazenamento</div>
          <h2>Disco</h2>
          <p>Escolha o disco alvo, revise o layout que será criado e avance com um plano claro antes de qualquer operação destrutiva.</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loadingDisks}
        >
          Atualizar discos
        </button>
      </header>

      <div className="disk-cockpit-grid">
        <section className="disk-section">
          <div className="disk-section-header">
            <div>
              <h3>Disco alvo</h3>
              <p>{eligibleDisks.length} disco(s) elegíveis detectados pelo backend.</p>
            </div>
          </div>

          {loadingDisks ? (
            <div className="disk-loading">
              <div className="scan-dot" />
              Detectando discos…
            </div>
          ) : diskError ? (
            <div className="disk-error">Erro ao carregar discos: {diskError}</div>
          ) : eligibleDisks.length === 0 ? (
            <div className="disk-error">Nenhum disco elegível detectado para instalação.</div>
          ) : (
            <div className="disk-card-list">
              {eligibleDisks.map((disk, index) => (
                <DiskCard
                  key={disk.path}
                  disk={disk}
                  selected={disk.path === selectedPath}
                  onSelect={() => selectDisk(disk.path)}
                />
              ))}
            </div>
          )}

          {blockedDisks.length > 0 ? (
            <details className="blocked-disks">
              <summary>Ver discos bloqueados ({blockedDisks.length})</summary>
              <div className="disk-card-list">
                {blockedDisks.map((disk) => (
                  <DiskCard
                    key={disk.path}
                    disk={disk}
                    selected={false}
                    onSelect={() => {}}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <section className="disk-section">
          <RecommendedLayoutCard
            selectedDisk={selectedDisk}
            wizard={wizard}
            isManualMode={isManualMode}
          />

          <div className="disk-plan-compare">
            <PartitionBar
              title="Estado atual do disco"
              subtitle={selectedDisk ? diskLabel(selectedDisk) : 'Nenhum disco selecionado'}
              parts={selectedPartitions}
              totalBytes={diskSizeBytes(selectedDisk)}
              emptyLabel="sem partições detectadas"
            />
            <PartitionBar
              title="Como ficará após a instalação"
              subtitle={isManualMode ? 'Plano manual sincronizado' : 'Layout automático recomendado'}
              parts={activePlan}
              totalBytes={diskSizeBytes(selectedDisk)}
              emptyLabel="selecione um disco para gerar o preview"
            />
          </div>

          {(activeValidation.blockingReasons?.length > 0 || activeValidation.warnings?.length > 0) ? (
            <div className="disk-validation" role="alert">
              {(activeValidation.blockingReasons || []).map((issue) => (
                <div key={issue} className="validation-item danger">
                  <span className="validation-icon" aria-hidden="true">✕</span>
                  {issue}
                </div>
              ))}
              {(activeValidation.warnings || []).map((warning) => (
                <div key={warning} className="validation-item warning">
                  <span className="validation-icon" aria-hidden="true">⚠</span>
                  {warning}
                </div>
              ))}
            </div>
          ) : (
            <div className="disk-validation">
              <div className="validation-item ok">
                <span className="validation-icon" aria-hidden="true">✓</span>
                Plano pronto para validação final no dry-run do backend.
              </div>
            </div>
          )}

          <div className="disk-risk-callout">
            <div className="risk-icon" aria-hidden="true">⚠</div>
            <div className="risk-content">
              <strong>Impacto: </strong>a instalação apaga e reparticiona o disco selecionado quando executada.
              Esta tela só prepara o plano; a confirmação destrutiva final continua nas próximas etapas.
            </div>
          </div>

          <div className="disk-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedDisk || isManualMode}
              onClick={useRecommended}
            >
              Usar layout recomendado
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!selectedDisk}
              onClick={openManual}
            >
              Ajustar manualmente
            </button>
            {isManualMode && (
              <button
                type="button"
                className="btn-ghost"
                onClick={useRecommended}
              >
                Voltar ao automático
              </button>
            )}
          </div>
        </section>
      </div>

      {manualOpen ? (
        <ManualDrawer
          wizard={wizard}
          selectedDisk={selectedDisk}
          manualValidation={manualValidation}
          onChange={onChange}
          onClose={() => setManualOpen(false)}
          onUseRecommended={useRecommended}
        />
      ) : null}
    </div>
  );
}