import { useState, useCallback, useRef } from 'react';

export function useUndoRedo<T>(initialState: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);
  
  const baseState = useRef<T>(initialState);
  const isTransient = useRef(false);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setPast(newPast);
    setFuture([present, ...future]);
    setPresent(previous);
    
    baseState.current = previous;
    isTransient.current = false;
  }, [past, present, future]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast([...past, present]);
    setFuture(newFuture);
    setPresent(next);
    
    baseState.current = next;
    isTransient.current = false;
  }, [past, present, future]);

  const set = useCallback((newState: T | ((prevState: T) => T), options?: { transient?: boolean, replace?: boolean }) => {
    setPresent(currentPresent => {
      const resolvedState = typeof newState === 'function' ? (newState as Function)(currentPresent) : newState;
      
      if (options?.replace) {
        return resolvedState;
      }

      if (options?.transient) {
        if (!isTransient.current) {
          isTransient.current = true;
          baseState.current = currentPresent;
        }
      } else {
        // Commit
        if (isTransient.current) {
          // We are ending a transient state
          if (baseState.current !== resolvedState) {
            setPast(p => [...p, baseState.current]);
            setFuture([]);
          }
        } else {
          // Discrete action
          if (currentPresent !== resolvedState) {
            setPast(p => [...p, currentPresent]);
            setFuture([]);
          }
        }
        isTransient.current = false;
        baseState.current = resolvedState;
      }
      
      return resolvedState;
    });
  }, []);

  const reset = useCallback((newState: T) => {
    setPast([]);
    setPresent(newState);
    setFuture([]);
    baseState.current = newState;
    isTransient.current = false;
  }, []);

  return { state: present, set, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0, reset };
}
