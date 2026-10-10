import { loadSave, storeSave } from '../game/save';
export const saveApi = { read: loadSave, write: storeSave };
export { loadMirror, storeMirror } from '../game/endlessMirror';
