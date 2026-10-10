import { clearDialogModel } from './model/boardProjection';

export function useClearDialogService(total: number) {
  return clearDialogModel(total);
}
