import { confettiPiecesModel, type ConfettiPiece } from '../shared/confettiModel';

export function useConfettiService(count?: number): ConfettiPiece[] {
  return confettiPiecesModel(count);
}
