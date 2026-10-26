import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toLocalISODate } from '../utils/dateUtils.js';
import {
  loadStoredState,
  saveStoredState,
  createInitialState,
  CURRENT_SCHEMA_VERSION,
  recordScheduleVersion,
  restoreScheduleVersion,
} from '../utils/storage.js';
import {
  addTask as pureAddTask,
  editTask as pureEditTask,
  deleteTask as pureDeleteTask,
  setTaskStatus as pureSetTaskStatus,
  rescheduleTask as pureRescheduleTask,
  moveTaskToDate as pureMoveTaskToDate,
  shortenTask as pureShortenTask,
} from '../utils/taskOperations.js';

const PlannerContext = createContext(null);

export function PlannerProvider({ children }) {
  // Current active date in UI (defaults to local date)
  const [selectedDate, setSelectedDate] = useState(() => toLocalISODate());

  // In-memory store: { schemaVersion, plans }
  const [store, setStore] = useState(() => createInitialState());
  const [storageError, setStorageError] = useState(null);

  // In-progress form draft separate from saved plans
  // Draft persists across tab navigation until explicitly saved or discarded
  const [formDraft, setFormDraft] = useState(null);

  // Undo snapshot: in-memory ONLY. Lost on page refresh.
  // Holds complete snapshot of whole store across all dates.
  const [undoSnapshot, setUndoSnapshot] = useState(null);

  // Toast state: { message, type, showUndo }
  const [toast, setToast] = useState(null);

  // Load plans from localStorage on mount
  useEffect(() => {
    const { state, error } = loadStoredState();
    if (error) {
      setStorageError(error);
    }
    setStore(state);
  }, []);

  // Retrieve plan for a specific date
  const getPlan = useCallback(
    (date) => {
      return store.plans[date] || null;
    },
    [store]
  );

  // Save plan for date (full plan update, e.g. from planning form, schedule generator, or AI proposal)
  const savePlan = useCallback(
    (date, planData, meta = {}) => {
      const currentStore = store;
      const snapshot = JSON.parse(JSON.stringify(currentStore));

      const updatedPlans = {
        ...currentStore.plans,
        [date]: {
          ...planData,
          date,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          createdAt: planData.createdAt || new Date().toISOString(),
        },
      };

      const nextStore = {
        ...currentStore,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        plans: updatedPlans,
      };

      const saveResult = saveStoredState(nextStore);
      if (!saveResult.success) {
        // Rollback: keep previous store in memory
        setStorageError(saveResult.error);
        return false;
      }

      setStore(nextStore);
      setStorageError(null);

      // Record schedule version snapshot for undo / restore history
      if (planData.schedule || meta.recordVersion) {
        try {
          recordScheduleVersion({
            date,
            author: meta.author || 'User',
            action: meta.action || (meta.author === 'Gemini AI' ? 'AI Proposal Applied' : 'Schedule Saved'),
            summary: meta.summary || `${meta.author === 'Gemini AI' ? 'AI' : 'Manual'} timetable for ${date}`,
            plan: planData,
            proposalApplied: Boolean(meta.proposalApplied),
          });
        } catch (err) {
          console.warn('Could not record schedule version:', err);
        }
      }

      return true;
    },
    [store]
  );

  // Delete plan for date
  const deletePlan = useCallback(
    (date) => {
      const currentStore = store;
      const nextPlans = { ...currentStore.plans };
      delete nextPlans[date];

      const nextStore = {
        ...currentStore,
        plans: nextPlans,
      };

      const saveResult = saveStoredState(nextStore);
      if (!saveResult.success) {
        setStorageError(saveResult.error);
        return false;
      }

      setStore(nextStore);
      setStorageError(null);
      return true;
    },
    [store]
  );

  // Helper to execute any pure task operation with atomic persistence & rollback
  const executeOperation = useCallback(
    (opFn, opDescription, ...args) => {
      const currentStore = store;
      const snapshot = JSON.parse(JSON.stringify(currentStore));

      const result = opFn(currentStore, ...args);
      if (!result.ok) {
        return result;
      }

      const saveResult = saveStoredState(result.store);
      if (!saveResult.success) {
        // Atomic rollback: keep previous in-memory state
        setStorageError(saveResult.error);
        return {
          ok: false,
          store: currentStore,
          errors: [`Persistence failed: ${saveResult.error}. Changes were rolled back.`],
        };
      }

      // Persisted successfully: commit in-memory store
      setStore(result.store);
      setStorageError(null);

      // Record 1-level undo snapshot (replaces previous snapshot)
      setUndoSnapshot(snapshot);

      // Show toast with Undo option
      setToast({
        message: opDescription || 'Task updated successfully.',
        type: 'success',
        showUndo: true,
      });

      return result;
    },
    [store]
  );

  // Atomic Task Operations wrapped with context
  const addTaskOp = useCallback(
    (date, taskData) => {
      return executeOperation(
        pureAddTask,
        `Added task "${taskData.name}"`,
        date,
        taskData
      );
    },
    [executeOperation]
  );

  const editTaskOp = useCallback(
    (date, taskId, updates) => {
      return executeOperation(
        pureEditTask,
        `Updated task "${updates.name || 'details'}"`,
        date,
        taskId,
        updates
      );
    },
    [executeOperation]
  );

  const deleteTaskOp = useCallback(
    (date, taskId, options = {}) => {
      const currentPlan = store.plans[date];
      const taskName = currentPlan?.tasks?.find((t) => t.id === taskId)?.name || 'task';
      return executeOperation(
        pureDeleteTask,
        `Deleted task "${taskName}"`,
        date,
        taskId,
        options
      );
    },
    [executeOperation, store]
  );

  const setTaskStatusOp = useCallback(
    (date, taskId, newStatus, options = {}) => {
      const currentPlan = store.plans[date];
      const taskName = currentPlan?.tasks?.find((t) => t.id === taskId)?.name || 'task';
      const label =
        newStatus === 'completed'
          ? `Completed "${taskName}"`
          : newStatus === 'in_progress'
          ? `Started "${taskName}"`
          : newStatus === 'skipped'
          ? `Skipped "${taskName}"`
          : `Reopened "${taskName}"`;

      return executeOperation(
        pureSetTaskStatus,
        label,
        date,
        taskId,
        newStatus,
        options
      );
    },
    [executeOperation, store]
  );

  const rescheduleTaskOp = useCallback(
    (date, taskId, newStart, newEnd, options = {}) => {
      const currentPlan = store.plans[date];
      const taskName = currentPlan?.tasks?.find((t) => t.id === taskId)?.name || 'task';
      return executeOperation(
        pureRescheduleTask,
        `Rescheduled "${taskName}" to ${newStart} - ${newEnd}`,
        date,
        taskId,
        newStart,
        newEnd,
        options
      );
    },
    [executeOperation, store]
  );

  const moveTaskToDateOp = useCallback(
    (fromDate, toDate, taskId) => {
      const currentPlan = store.plans[fromDate];
      const taskName = currentPlan?.tasks?.find((t) => t.id === taskId)?.name || 'task';
      return executeOperation(
        pureMoveTaskToDate,
        `Moved "${taskName}" to ${toDate}`,
        fromDate,
        toDate,
        taskId
      );
    },
    [executeOperation, store]
  );

  const shortenTaskOp = useCallback(
    (date, taskId, newDuration) => {
      const currentPlan = store.plans[date];
      const taskName = currentPlan?.tasks?.find((t) => t.id === taskId)?.name || 'task';
      return executeOperation(
        pureShortenTask,
        `Shortened "${taskName}" to ${newDuration} mins`,
        date,
        taskId,
        newDuration
      );
    },
    [executeOperation, store]
  );

  // Undo last confirmed operation
  const undoLastAction = useCallback(() => {
    if (!undoSnapshot) return;

    const saveResult = saveStoredState(undoSnapshot);
    if (!saveResult.success) {
      setStorageError(`Failed to restore previous state: ${saveResult.error}`);
      return;
    }

    setStore(undoSnapshot);
    setUndoSnapshot(null);
    setToast({
      message: 'Action undone successfully.',
      type: 'info',
      showUndo: false,
    });
  }, [undoSnapshot]);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // Update form draft in progress
  const updateDraft = useCallback((draftData, step = 1) => {
    setFormDraft({
      data: draftData,
      step,
      isDirty: true,
      lastUpdated: Date.now(),
    });
  }, []);

  // Clear form draft
  const clearDraft = useCallback(() => {
    setFormDraft(null);
  }, []);

  // Restore an earlier schedule version from history
  const restoreScheduleVersionOp = useCallback(
    (versionId) => {
      const result = restoreScheduleVersion(versionId, store.plans);
      if (!result.success) {
        setStorageError(result.error);
        return false;
      }

      const saveSuccess = savePlan(result.targetDate, result.restoredPlan, {
        recordVersion: true,
        action: 'Schedule Restored',
        author: 'User',
        summary: `Restored version from ${new Date(result.version.timestamp).toLocaleTimeString()}`,
      });

      if (saveSuccess) {
        setToast({
          message: `Restored schedule version from ${new Date(result.version.timestamp).toLocaleTimeString()}`,
          type: 'success',
          showUndo: true,
        });
        return true;
      }
      return false;
    },
    [store, savePlan]
  );

  const value = {
    selectedDate,
    setSelectedDate,
    plans: store.plans,
    store,
    getPlan,
    savePlan,
    deletePlan,
    formDraft,
    updateDraft,
    clearDraft,
    storageError,
    clearStorageError: () => setStorageError(null),
    // Task operations
    addTaskOp,
    editTaskOp,
    deleteTaskOp,
    setTaskStatusOp,
    rescheduleTaskOp,
    moveTaskToDateOp,
    shortenTaskOp,
    // History & Undo
    restoreScheduleVersionOp,
    toast,
    dismissToast,
    undoLastAction,
    canUndo: Boolean(undoSnapshot),
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlanner must be used within a PlannerProvider');
  }
  return context;
}
