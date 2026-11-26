import { ask, open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { Download, FolderOpen, HardDrive } from 'lucide-react';
import { useState } from 'react';

import { useConfigStore } from '../../../stores/configStore';
import { useSpooferStore } from '../../../stores/spooferStore';
import {
  decodeBackup,
  encodeBackup,
  MAX_BACKUP_BYTES,
  restoreBackupStorage,
} from '../../../utils/dataBackup';
import { Button } from '../../ui/button';
import { SettingCard } from './SettingComponents';

export default function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const exportBackup = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { config } = useConfigStore.getState();
      const state = useSpooferStore.getState();
      const text = encodeBackup({
        config,
        replacements: state.lastReplacements,
        placeIds: state.assetForcePlaceIds,
        appearance: {
          theme: localStorage.getItem('theme') as 'light' | 'dark' | null,
          accentColor: localStorage.getItem('accentColor'),
          language: localStorage.getItem('language') as 'en' | 'es' | 'ru' | 'fr' | null,
        },
      });
      const path = await save({
        defaultPath: 'IspooferMotion-pm-data.json',
        filters: [{ name: 'App data backup', extensions: ['json'] }],
      });
      if (!path) return;
      await writeTextFile(path, text);
      setMessage('Backup saved. Keep this file outside the app installation folder.');
    } catch {
      setMessage('Could not export the backup. Check the destination and try again.');
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    setBusy(true);
    setMessage('');
    try {
      const state = useSpooferStore.getState();
      if (
        state.isSpoofing ||
        state.isReplacing ||
        state.isGrantingPermissions ||
        state.isScanningStudio
      ) {
        setMessage('Finish or stop the current operation before restoring a backup.');
        return;
      }
      const path = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'App data backup', extensions: ['json'] }],
      });
      if (!path) return;
      if ((await stat(path)).size > MAX_BACKUP_BYTES) {
        setMessage('This file is too large. App backups must be 5 MB or smaller.');
        return;
      }
      const backup = decodeBackup(await readTextFile(path));
      const confirmed = await ask(
        'Replace settings, account names, replacement mappings, and place IDs with this backup? The app will reload. Cookies and API keys are not restored. Export your current data first if you want to keep it.',
        { title: 'Restore app data', kind: 'warning' },
      );
      if (!confirmed) return;
      restoreBackupStorage(backup, localStorage);
      window.location.reload();
    } catch {
      setMessage(
        'Could not restore this backup. Check that it is a valid app backup and storage is available.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingCard
      icon={HardDrive}
      title="Backups"
      description="Keep your data when reinstalling or updating manually."
    >
      <div className="p-4 space-y-3">
        <p className="text-xs text-text-secondary">
          Settings, account names, replacement mappings, place IDs, theme, and language are
          included. Cookies, API keys, proxy addresses, downloaded assets, and place files are
          excluded. After a full uninstall or moving to another computer, sign in again as needed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={exportBackup}>
            <Download size={14} /> Export backup
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={importBackup}>
            <FolderOpen size={14} /> Restore backup
          </Button>
        </div>
        <p className="text-xs text-text-secondary">
          Save the JSON file in Documents or another folder outside the app. Export again after
          changes. Updating over your existing V2 installation normally keeps its saved data
          automatically.
        </p>
        {message && (
          <p role="status" className="text-xs text-text-primary">
            {message}
          </p>
        )}
      </div>
    </SettingCard>
  );
}
