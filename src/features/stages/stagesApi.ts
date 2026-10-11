import { stageCatalog } from "./catalog";
export type { Stage, Chapter } from "./catalog";
export async function fetchStages() { return stageCatalog(); }
