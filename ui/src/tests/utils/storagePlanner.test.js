import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSingleDiskLayout,
  validateSplitDiskLayout,
  validateRaidSelection,
  normalizeDiskInventory,
  calculateRaidUsableCapacity
} from '../../utils/storagePlanner.js';

describe('storagePlanner', () => {
  const dummyDisks = [
    { name: 'sda', path: '/dev/sda', sizeBytes: 500 * 1024 * 1024 * 1024, type: 'disk', readOnly: false, removable: false },
    { name: 'sdb', path: '/dev/sdb', sizeBytes: 500 * 1024 * 1024 * 1024, type: 'disk', readOnly: false, removable: false },
    { name: 'sdc', path: '/dev/sdc', sizeBytes: 1000 * 1024 * 1024 * 1024, type: 'disk', readOnly: false, removable: false },
    { name: 'usb', path: '/dev/sdd', sizeBytes: 32 * 1024 * 1024 * 1024, type: 'disk', readOnly: false, removable: true },
    { name: 'sde', path: '/dev/sde', sizeBytes: 500 * 1024 * 1024 * 1024, type: 'disk', readOnly: false, removable: false },
    { name: 'sdf', path: '/dev/sdf', sizeBytes: 500 * 1024 * 1024 * 1024, type: 'disk', readOnly: false, removable: false },
    { name: 'sdg', path: '/dev/sdg', sizeBytes: 500 * 1024 * 1024 * 1024, type: 'disk', readOnly: false, removable: false }
  ];

  const inventory = normalizeDiskInventory(dummyDisks);

  describe('validateSingleDiskLayout', () => {
    it('requires a selected disk', () => {
      const result = validateSingleDiskLayout(inventory, '');
      assert.equal(result.valid, false);
      assert.match(result.blockingReasons[0], /Selecione o disco/);
    });

    it('validates eligible disk', () => {
      const result = validateSingleDiskLayout(inventory, '/dev/sda');
      assert.equal(result.valid, true);
      assert.equal(result.blockingReasons.length, 0);
    });

    it('rejects ineligible disk', () => {
      const result = validateSingleDiskLayout(inventory, '/dev/sdd');
      assert.equal(result.valid, false);
      assert.match(result.blockingReasons[0], /removiveis\/USB/i);
    });
  });

  describe('validateSplitDiskLayout', () => {
    it('requires both disks to be different', () => {
      const resultSame = validateSplitDiskLayout(inventory, '/dev/sda', '/dev/sda');
      assert.equal(resultSame.valid, false);
      assert.equal(resultSame.blockingReasons.includes('O mesmo disco nao pode ocupar os papeis de raiz e dados.'), true);
    });

    it('validates two distinct eligible disks', () => {
      const result = validateSplitDiskLayout(inventory, '/dev/sda', '/dev/sdb');
      assert.equal(result.valid, true);
    });
  });

  describe('validateRaidSelection', () => {
    it('validates RAID 1 with 2 homogeneous disks', () => {
      const result = validateRaidSelection([inventory[0], inventory[1]], 'raid1');
      assert.equal(result.valid, true);
    });

    it('rejects RAID 1 with heterogeneous disks if deviation > 5%', () => {
      const result = validateRaidSelection([inventory[0], inventory[2]], 'raid1');
      assert.equal(result.valid, false);
      assert.match(result.blockingReasons[0], /homogeneos/i);
    });

    it('validates RAID 0 with heterogeneous disks but warns about waste', () => {
      const result = validateRaidSelection([inventory[0], inventory[2]], 'raid0');
      assert.equal(result.valid, true);
      assert.equal(result.warnings.length > 0, true);
      assert.equal(result.summary.mismatchWasteBytes > 0, true);
    });

    it('rejects RAID 5 with < 3 disks', () => {
      const result = validateRaidSelection([inventory[0], inventory[1]], 'raid5');
      assert.equal(result.valid, false);
      assert.match(result.blockingReasons[0], /no minimo 3 discos/);
    });
    
    it('rejects RAID 10 with odd number of disks (5 disks)', () => {
      const result = validateRaidSelection([inventory[0], inventory[1], inventory[4], inventory[5], inventory[6]], 'raid10');
      assert.equal(result.valid, false);
      assert.match(result.blockingReasons[0], /quantidade par de discos/);
    });
  });
});
