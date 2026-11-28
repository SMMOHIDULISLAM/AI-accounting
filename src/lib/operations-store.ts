import { validateOperations, type Operations } from "./operations";
export interface OperationsStorage {
  load(): Promise<unknown | undefined>;
  save(content: unknown): Promise<void>;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ai-accounting-operations", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export const localOperationsStorage: OperationsStorage = {
  async load() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const r = db
        .transaction("workspace", "readonly")
        .objectStore("workspace")
        .get("local");
      r.onsuccess = () => {
        db.close();
        resolve(r.result);
      };
      r.onerror = () => {
        db.close();
        reject(r.error);
      };
    });
  },
  async save(content) {
    validateOperations(content);
    const db = await open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite");
      tx.objectStore("workspace").put(content, "local");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || Error("Operations save was aborted"));
      };
    });
  },
};
export function parseOperationsBackup(text: string): Operations {
  return validateOperations(JSON.parse(text));
}
