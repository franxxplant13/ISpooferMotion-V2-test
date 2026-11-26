import { invoke } from '@tauri-apps/api/core';

export async function runSplashFlow() {
  const statusText = document.getElementById('status-text');
  const setStatus = (message: string) => {
    if (statusText) statusText.textContent = message;
  };

  setStatus('Installing plugin to Roblox...');
  try {
    await invoke('sync_roblox_plugin');
  } catch (error) {
    console.error('Failed to sync Roblox plugin:', error);
  }

  setStatus('Starting...');
  try {
    const opened = await invoke<boolean>('close_splashscreen');
    if (!opened) setStatus('Unable to open the main window. Please restart the app.');
  } catch (error) {
    console.error('Failed to open main window:', error);
    setStatus('Unable to open the main window. Please restart the app.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  void runSplashFlow();
});
