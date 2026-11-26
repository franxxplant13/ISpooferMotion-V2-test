import { z } from 'zod';

import { type AppConfig, AppConfigSchema } from '../stores/configStore';

const id = z.string().regex(/^[1-9]\d{0,19}$/);
const idMap = z.record(id, id);
const BackupSchema = z.object({
  format: z.literal('IspooferMotion-pm-backup'),
  version: z.literal(1),
  createdAt: z.string(),
  config: AppConfigSchema,
  replacements: idMap,
  placeIds: idMap,
  appearance: z.object({
    theme: z.enum(['light', 'dark']).nullable(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i)
      .nullable(),
    language: z.enum(['en', 'es', 'ru', 'fr']).nullable(),
  }),
});

export type DataBackup = z.infer<typeof BackupSchema>;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export function withoutCredentials(config: AppConfig): AppConfig {
  // Parse first to strip unknown fields, including legacy account credential fields.
  const clean = AppConfigSchema.parse(config);
  clean.spoofing.cookie = '';
  clean.spoofing.apiKey = '';
  clean.spoofing.groupApiKey = '';
  clean.advanced.proxyUrl = ''; // A proxy address can contain a username/password.
  clean.general.telemetryEnabled = false;
  clean.accounts = clean.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    isDownloader: account.isDownloader,
    isUploader: account.isUploader,
    cookieValidated: false,
    apiKeyValidated: false,
  }));
  return clean;
}

export function encodeBackup(data: Omit<DataBackup, 'format' | 'version' | 'createdAt'>): string {
  const backup = BackupSchema.parse({
    ...data,
    config: withoutCredentials(data.config),
    format: 'IspooferMotion-pm-backup',
    version: 1,
    createdAt: new Date().toISOString(),
  });
  const text = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) {
    throw new Error('Backup exceeds the 5 MB size limit.');
  }
  return text;
}

export function decodeBackup(text: string): DataBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) {
    throw new Error('Backup exceeds the 5 MB size limit.');
  }
  const backup = BackupSchema.parse(JSON.parse(text));
  backup.config = withoutCredentials(backup.config);
  return backup;
}

// Only these allowlisted storage keys are restored. No credentials are written to disk.
export function restoreBackupStorage(backup: DataBackup, storage: Storage): void {
  const entries: [string, string][] = [
    ['ISpooferMotion_Config', JSON.stringify(withoutCredentials(backup.config))],
    ['ISpooferMotion_SavedReplacements', JSON.stringify(backup.replacements)],
    ['ISpooferMotion_SavedPlaceIds', JSON.stringify(backup.placeIds)],
  ];
  for (const [key, value] of Object.entries(backup.appearance)) {
    if (value !== null) entries.push([key, value]);
  }
  const previous = entries.map(([key]) => [key, storage.getItem(key)] as const);
  try {
    for (const [key, value] of entries) storage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of previous) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        /* Preserve the original storage failure. */
      }
    }
    throw error;
  }
}
