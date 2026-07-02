import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialExecutionState,
  hydrateExecutionState,
  applyExecutionStatus,
  getInstallExecutionPhase,
  INSTALL_EXECUTION_PHASES,
  buildInstallStageList
} from '../../utils/installExecution.js';

describe('installExecution', () => {
  describe('createInitialExecutionState', () => {
    it('creates idle state', () => {
      const state = createInitialExecutionState();
      assert.equal(state.phase, INSTALL_EXECUTION_PHASES.IDLE);
      assert.equal(state.status.running, false);
      assert.equal(state.planSubmitted, false);
    });
  });

  describe('hydrateExecutionState', () => {
    it('hydrates running state correctly', () => {
      const payload = {
        running: true,
        havePlan: true,
        currentPhase: 'DISK'
      };
      
      const state = hydrateExecutionState(payload, 'Starting disk check...\n');
      assert.equal(state.phase, INSTALL_EXECUTION_PHASES.RUNNING);
      assert.equal(state.streamConnected, true);
      assert.equal(state.planSubmitted, true);
      assert.equal(state.logTail.includes('Starting disk check...'), true);
    });

    it('hydrates completed state', () => {
      const payload = {
        running: false,
        exitCode: 0,
        havePlan: true
      };
      
      const state = hydrateExecutionState(payload);
      assert.equal(state.phase, INSTALL_EXECUTION_PHASES.COMPLETED);
    });

    it('hydrates failed state', () => {
      const payload = {
        running: false,
        exitCode: 1,
        havePlan: true,
        lastError: 'failed to format'
      };
      
      const state = hydrateExecutionState(payload);
      assert.equal(state.phase, INSTALL_EXECUTION_PHASES.FAILED);
      assert.equal(state.status.lastError, 'failed to format');
    });
  });

  describe('applyExecutionStatus', () => {
    it('transitions state correctly', () => {
      let state = createInitialExecutionState();
      
      // Start install
      state = applyExecutionStatus(state, { running: true, currentPhase: 'PRECHECK', havePlan: true });
      assert.equal(state.phase, INSTALL_EXECUTION_PHASES.RUNNING);
      
      // Fail install
      state = applyExecutionStatus(state, { running: false, exitCode: 127, currentPhase: 'PARTITION' });
      assert.equal(state.phase, INSTALL_EXECUTION_PHASES.FAILED);
      assert.equal(state.status.exitCode, 127);
    });
  });

  describe('buildInstallStageList', () => {
    it('marks completed phases as done and current as active', () => {
      const payload = {
        running: true,
        currentPhase: 'FS'
      };
      const stages = buildInstallStageList(payload);
      
      assert.equal(stages.find(s => s.id === 'PRECHECK').state, 'done');
      assert.equal(stages.find(s => s.id === 'PARTITION').state, 'done');
      assert.equal(stages.find(s => s.id === 'FS').state, 'active');
      assert.equal(stages.find(s => s.id === 'MOUNT').state, 'pending');
    });

    it('marks all as done if completed', () => {
      const payload = {
        running: false,
        exitCode: 0
      };
      const stages = buildInstallStageList(payload);
      assert.equal(stages.every(s => s.state === 'done'), true);
    });
    
    it('marks current phase as failed if failed', () => {
      const payload = {
        running: false,
        exitCode: 1,
        currentPhase: 'INSTALL'
      };
      const stages = buildInstallStageList(payload);
      assert.equal(stages.find(s => s.id === 'INSTALL').state, 'failed');
      assert.equal(stages.find(s => s.id === 'VERIFY').state, 'pending');
    });
  });
});
