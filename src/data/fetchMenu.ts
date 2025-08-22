import { get, set } from './idb';
import type { MenuData } from '../state/useMenuStore';

const DATA_KEY = 'menu:data';
const ETAG_KEY = 'menu:etag';

export async function fetchRemoteMenu(): Promise<MenuData | undefined> {
  const etag = await get<string>(ETAG_KEY);
  const res = await fetch('/data/menu.json', {
    headers: etag ? { 'If-None-Match': etag } : {}
  });
  if (res.status === 304) {
    return get<MenuData>(DATA_KEY);
  }
  if (res.ok) {
    const data = (await res.json()) as MenuData;
    const newEtag = res.headers.get('ETag') || undefined;
    await set(DATA_KEY, data);
    if (newEtag) await set(ETAG_KEY, newEtag);
    return data;
  }
  throw new Error('Network error');
}
