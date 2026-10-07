import { chatgptAdapter } from './chatgpt';
import type { SiteAdapter } from './types';

export const adapters: SiteAdapter[] = [chatgptAdapter];

export function adapterFor(url: string | URL | undefined): SiteAdapter | undefined {
  if (!url) return undefined;
  try {
    const u = typeof url === 'string' ? new URL(url) : url;
    return adapters.find((a) => a.matches(u));
  } catch {
    return undefined;
  }
}
