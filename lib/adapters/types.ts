import type { Block, Conversation, Role } from '../model';

/** Adding a site (Claude in phase 4, Gemini later) means writing one of these. */
export interface SiteAdapter {
  id: Conversation['platform'];
  matches(url: URL): boolean;
  getTitle(): string;
  getMessageElements(): Element[];
  getRole(el: Element): Role | null; // null = not a user/assistant turn (tool messages etc.)
  toBlocks(el: Element): Block[];
}
