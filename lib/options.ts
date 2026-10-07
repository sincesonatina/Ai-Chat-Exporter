import { storage } from '#imports';
import type { ExportFormat } from './model';

export interface ExportOptions {
  userLabel: string;
  assistantLabel: string;
  defaultFormat: ExportFormat;
  fileNamePattern: string; // tokens: {title} {date} {platform}
  includeHeader: boolean;
  paperSize: 'A4' | 'LETTER';
}

export const DEFAULT_OPTIONS: ExportOptions = {
  userLabel: 'You:',
  assistantLabel: 'Response:',
  defaultFormat: 'md',
  fileNamePattern: '{title}_{date}',
  includeHeader: true,
  paperSize: 'A4',
};

export const optionsItem = storage.defineItem<ExportOptions>('sync:options', {
  fallback: DEFAULT_OPTIONS,
});

export async function getOptions(): Promise<ExportOptions> {
  // Merge so options added in later versions get their defaults.
  return { ...DEFAULT_OPTIONS, ...(await optionsItem.getValue()) };
}
