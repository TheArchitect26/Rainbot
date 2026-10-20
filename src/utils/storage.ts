/** Keep play available when browser storage is disabled or full. Never erase legacy keys. */
let failed = false;
export const hasStorageFailure = () => failed;
const memory = new Map<string, string>();
export const storage = {
  getItem(key: string): string | null {
    try {
      return memory.get(key) ?? localStorage.getItem(key);
    } catch {
      failed = true;
      return memory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
      memory.delete(key);
    } catch {
      failed = true;
      memory.set(key, value);
    }
  },
};
export function readNumber(key: string, fallback = 0): number {
  const value = Number(storage.getItem(key) ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
