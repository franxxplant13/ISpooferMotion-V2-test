import { describe, expect, test } from 'bun:test';

import { DEFAULT_APP_CONFIG } from '../src/stores/configStore';
import { decodeBackup, encodeBackup, restoreBackupStorage } from '../src/utils/dataBackup';

const fixture = () => ({
  config: structuredClone(DEFAULT_APP_CONFIG),
  replacements: { '123': '456' },
  placeIds: { '123': '789' },
  appearance: { theme: 'dark' as const, accentColor: '#10b981', language: 'en' as const },
});

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('portable app data backups', () => {
  test('round trips saved data while removing credentials and validation claims', () => {
    const data = fixture();
    data.config.spoofing.cookie = 'COOKIE_SECRET';
    data.config.spoofing.apiKey = 'API_SECRET';
    data.config.spoofing.groupApiKey = 'GROUP_SECRET';
    data.config.advanced.proxyUrl = 'https://user:PROXY_SECRET@example.com';
    data.config.accounts = [
      { id: '123', name: 'Alt', isDownloader: true, isUploader: false, cookieValidated: true },
    ];
    const text = encodeBackup(data);
    for (const secret of ['COOKIE_SECRET', 'API_SECRET', 'GROUP_SECRET', 'PROXY_SECRET']) {
      expect(text).not.toContain(secret);
    }
    const backup = decodeBackup(text);
    expect(backup.replacements).toEqual(data.replacements);
    expect(backup.placeIds).toEqual(data.placeIds);
    expect(backup.config.accounts[0].name).toBe('Alt');
    expect(backup.config.accounts[0].cookieValidated).toBe(false);
    expect(data.config.spoofing.cookie).toBe('COOKIE_SECRET');
  });

  test('import strips injected credentials and unknown account secret fields', () => {
    const raw = JSON.parse(encodeBackup(fixture()));
    raw.config.spoofing.cookie = 'INJECTED_SECRET';
    raw.config.accounts = [{ id: '123', name: 'Alt', cookie: 'ACCOUNT_SECRET' }];
    const imported = decodeBackup(JSON.stringify(raw));
    expect(imported.config.spoofing.cookie).toBe('');
    expect(JSON.stringify(imported)).not.toContain('ACCOUNT_SECRET');
  });

  test('rejects unrelated files, future versions, malformed IDs, and oversized files', () => {
    expect(() => decodeBackup('{}')).toThrow();
    expect(() => decodeBackup('bad json')).toThrow();
    const raw = JSON.parse(encodeBackup(fixture()));
    raw.version = 2;
    expect(() => decodeBackup(JSON.stringify(raw))).toThrow();
    raw.version = 1;
    raw.replacements = { '123': 'https://unexpected.example' };
    expect(() => decodeBackup(JSON.stringify(raw))).toThrow();
    expect(() => decodeBackup(' '.repeat(5 * 1024 * 1024 + 1))).toThrow();
  });

  test('restores only allowlisted data and retains unrelated local data', () => {
    const storage = new MemoryStorage();
    storage.setItem('unrelated', 'keep');
    restoreBackupStorage(decodeBackup(encodeBackup(fixture())), storage);
    expect(storage.getItem('ISpooferMotion_SavedReplacements')).toBe('{"123":"456"}');
    expect(storage.getItem('theme')).toBe('dark');
    expect(storage.getItem('unrelated')).toBe('keep');
    expect(storage.length).toBe(7);
  });

  test('rolls back earlier writes if storage fails mid-restore', () => {
    const storage = new MemoryStorage();
    storage.setItem('ISpooferMotion_Config', 'previous-config');
    storage.setItem('ISpooferMotion_SavedReplacements', 'previous-replacements');
    const originalSet = storage.setItem.bind(storage);
    let failed = false;
    storage.setItem = (key, value) => {
      if (key === 'ISpooferMotion_SavedPlaceIds' && !failed) {
        failed = true;
        throw new Error('Disk full');
      }
      originalSet(key, value);
    };
    expect(() => restoreBackupStorage(decodeBackup(encodeBackup(fixture())), storage)).toThrow(
      'Disk full',
    );
    expect(storage.getItem('ISpooferMotion_Config')).toBe('previous-config');
    expect(storage.getItem('ISpooferMotion_SavedReplacements')).toBe('previous-replacements');
    expect(storage.getItem('theme')).toBeNull();
  });
});
