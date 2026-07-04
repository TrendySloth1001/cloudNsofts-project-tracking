'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal } from './modal';
import { Button } from './button';
import styles from './confirm.module.css';

export interface ConfirmOptions {
  title: string;
  /** Body message — supports rich content (e.g. a bolded name). */
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` renders a red confirm button for destructive actions. */
  tone?: 'danger' | 'primary';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Imperative confirmation dialog — a drop-in, styled replacement for the
 *  native `window.confirm`. Returns a promise that resolves to the choice. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // Resolve any dialog that is somehow still pending before opening a new one.
    resolverRef.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => settle(false)}
        title={options?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              {options?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => settle(true)}
              autoFocus
            >
              {options?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {options?.message && (
          <p className={styles.message}>{options.message}</p>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
