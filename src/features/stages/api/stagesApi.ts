import { stageCatalog } from "../model/catalog";
export type { Stage, Chapter } from "../model/catalog";
export async function fetchStages() { return stageCatalog(); }
