import { useContext } from 'react';
import { ConfirmContext } from '../context/ConfirmContextValue';

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm doit être utilisé dans un ConfirmProvider.');
  return ctx;
}
