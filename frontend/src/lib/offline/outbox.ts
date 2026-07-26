"use client";

const DATABASE = "signal-offline";
const STORE = "outbox";
const VERSION = 1;

export interface QueuedMessage {
  clientMessageId: string;
  conversationId: string;
  body: string;
  replyToId?: string;
  attachmentIds: string[];
  queuedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "clientMessageId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function enqueue(message: QueuedMessage): Promise<void> {
  await withStore("readwrite", (store) => store.put(message));
}

export async function dequeue(clientMessageId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(clientMessageId));
}

export async function queued(): Promise<QueuedMessage[]> {
  const all = await withStore<QueuedMessage[]>("readonly", (store) => store.getAll());
  return all.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
}
