import { invoke } from '@tauri-apps/api/core';
import { Bug, FolderOpen, Trash2 } from 'lucide-react';

import { useConfig } from '../../../contexts/ConfigContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useSpooferStore } from '../../../stores/spooferStore';
import { logIsm } from '../../../utils/robloxProfiles';
import { Button } from '../../ui/button';
import { SettingCard, SettingSwitchRow } from './SettingComponents';

export default function DebugCard() {
  const { t } = useLanguage();
  const { config, updateConfig } = useConfig();

  async function handleClearCache(successMessage = 'Cache cleared.') {
    try {
      const store = useSpooferStore.getState();
      if (
        store.isSpoofing ||
        store.isReplacing ||
        store.isScanningStudio ||
        store.isGrantingPermissions ||
        store.isDiscoveringPlaceIds
      ) {
        store.showToast('error', 'Finish the current operation before clearing cache.');
        return;
      }
      await invoke('clear_asset_cache');
      await invoke('clear_app_cache');
      store.clearAssetStatuses();
      store.showToast('success', successMessage);
      logIsm('success', successMessage);
    } catch (err) {
      useSpooferStore.getState().showToast('error', `Failed to clear cache: ${String(err)}`);
      logIsm('error', `Failed to clear cache: ${String(err)}`);
    }
  }

  const handleCacheChange = async (enabled: boolean) => {
    updateConfig('debug', 'enableCache', enabled);
    if (enabled) {
      logIsm('success', 'Cache enabled.');
      return;
    }
    await handleClearCache('Cache disabled. Cached runtime data cleared.');
  };

  return (
    <SettingCard
      icon={Bug}
      title={t('debug.title') || 'Debug & Diagnostics'}
      description="Clear temporary asset data while keeping settings, saved mappings, accounts, and credentials."
    >
      <SettingSwitchRow
        label={t('settings.debugMode') || 'Developer Debug Mode'}
        description="Show floating real-time debug console for IPC and network tracing."
        checked={config.debug.debugMode}
        onCheckedChange={(v) => updateConfig('debug', 'debugMode', v)}
      />

      <SettingSwitchRow
        label={t('settings.enableCache') || 'Persistent File & Asset Cache'}
        description="Store downloaded meshes, images, and audio payloads on disk to speed up repeated scans."
        checked={config.debug.enableCache}
        onCheckedChange={handleCacheChange}
      />

      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-bg-base/20">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs font-semibold flex items-center justify-center gap-2"
          onClick={() => void handleClearCache()}
        >
          <Trash2 size={13} className="text-muted-foreground" />
          <span>{t('settings.clearCache') || 'Clear Local Cache'}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs font-semibold flex items-center justify-center gap-2"
          onClick={() =>
            invoke('open_logs_folder').catch((err) =>
              logIsm('error', `Failed to open logs folder: ${String(err)}`),
            )
          }
        >
          <FolderOpen size={13} className="text-muted-foreground" />
          <span>{t('settings.openLogsFolder') || 'Open Logs Folder'}</span>
        </Button>
      </div>
    </SettingCard>
  );
}
