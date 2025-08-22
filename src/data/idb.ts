import { openDB } from 'idb';

const dbPromise = openDB('menu-planner', 1, {
  upgrade(db) {
    db.createObjectStore('kv');
  }
});

export async function get<T>(key: string): Promise<T | undefined> {
  return (await dbPromise).get('kv', key);
}

export async function set<T>(key: string, value: T) {
  return (await dbPromise).put('kv', value, key);
}
