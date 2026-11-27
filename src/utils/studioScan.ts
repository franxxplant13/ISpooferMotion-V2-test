import { invoke } from '@tauri-apps/api/core';

import { addDebugLog } from './debugLogger';
import { fetchPluginBridge, findPluginBridgePort } from './pluginBridge';

const SCAN_STALL_MS = 300_000;
const SCAN_POLL_MS = 1500;

interface StudioHealth {
  scanStatus?: { scanning?: boolean; scanned?: number } | null;
  synced?: boolean;
  scanGeneration?: number;
  completedScanGeneration?: number;
  abortedScanGeneration?: number;
  scanRequestId?: string;
  scanId?: string;
}

interface ScanSession {
  requestId: string;
  ready: Promise<{ port: string; previousGeneration: number }>;
  cancelled: boolean;
  cancellation?: Promise<void>;
}

let activeScan: ScanSession | null = null;

export class StudioScanCancelled extends Error {
  constructor() {
    super('Studio scan cancelled.');
  }
}

const readStudioHealth = () => invoke<StudioHealth>('get_studio_health_status');

async function checkCancellation(session: ScanSession) {
  if (session.cancelled) {
    await session.cancellation;
    if (session.cancelled) throw new StudioScanCancelled();
  }
}

async function waitForStudioScanComplete(
  previousGeneration: number,
  session: ScanSession,
): Promise<void> {
  const startedAt = Date.now();
  let lastProgressScanned: number | undefined;
  let lastProgressTime = startedAt;
  let lastSyncedTime = startedAt;

  while (Date.now() - lastProgressTime < SCAN_STALL_MS) {
    await checkCancellation(session);
    const health = await readStudioHealth();
    const now = Date.now();

    if ((health.abortedScanGeneration ?? 0) > previousGeneration) {
      throw new Error('Studio stopped the scan before it finished. Check the plugin Console.');
    }
    if ((health.completedScanGeneration ?? 0) > previousGeneration) return;
    if (health.synced) {
      lastSyncedTime = now;
    } else if (now - lastSyncedTime > 5000) {
      throw new Error(
        'Roblox Studio is not connected or the ISpooferMotion plugin is disabled. Please open Studio and try again.',
      );
    }
    if ((health.scanGeneration ?? 0) <= previousGeneration) {
      if (now - startedAt > 20000) {
        throw new Error(
          'Studio did not start the requested scan. Please check the plugin and retry.',
        );
      }
    } else {
      const scanned = health.scanStatus?.scanned;
      if (scanned !== undefined && scanned !== lastProgressScanned) {
        lastProgressScanned = scanned;
        lastProgressTime = now;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, SCAN_POLL_MS));
  }
  throw new Error(
    'Studio scan stalled — no progress for 5 minutes. Check the plugin Console or cancel the scan and try a smaller scan path.',
  );
}

export interface ScanOptions {
  scanTypes: string[];
  scanPath?: string;
}

async function startScanRequest(options: ScanOptions | undefined, requestId: string) {
  const port = await findPluginBridgePort();
  if (!port) throw new Error('Please open the desktop app and connect Roblox Studio first.');
  const previousGeneration = (await readStudioHealth()).scanGeneration ?? 0;
  const scanTypes = options?.scanTypes ?? ['sounds', 'animations', 'images', 'meshes', 'scripts'];
  if (scanTypes.length === 0) throw new Error('Select at least one asset type to scan.');

  const response = await fetchPluginBridge('/request-scan', port, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, scanTypes, scanPath: options?.scanPath ?? '' }),
  });
  if (!response.ok) throw new Error('Could not request a Studio scan.');
  const result = (await response.json()) as { success?: boolean; error?: string };
  if (!result.success) throw new Error(result.error || 'Could not start a Studio scan.');
  addDebugLog('info', [
    `Studio scan requested. Types: ${scanTypes.join(', ')}. Path: ${options?.scanPath || 'all configured services'}.`,
  ]);
  return { port, previousGeneration };
}

export async function triggerStudioScan(options?: ScanOptions): Promise<void> {
  if (activeScan) throw new Error('A Studio scan is already running.');
  const requestId = crypto.randomUUID();
  const session: ScanSession = {
    requestId,
    ready: startScanRequest(options, requestId),
    cancelled: false,
  };
  activeScan = session;
  try {
    const { previousGeneration } = await session.ready;
    await checkCancellation(session);
    await waitForStudioScanComplete(previousGeneration, session);
  } finally {
    if (activeScan === session) activeScan = null;
  }
}

async function sendCancellation(port: string, identity: { requestId?: string; scanId?: string }) {
  const response = await fetchPluginBridge('/cancel-scan', port, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });
  if (!response.ok) throw new Error('Could not send scan cancellation. Try again.');
  const result = (await response.json()) as { success?: boolean };
  if (!result.success) throw new Error('Studio scan cancellation was rejected. Try again.');
  addDebugLog('info', ['Studio scan cancellation accepted. Unfinished results will be discarded.']);
}

export async function cancelStudioScan(): Promise<void> {
  const session = activeScan;
  if (session) {
    if (session.cancellation) return session.cancellation;
    session.cancelled = true;
    session.cancellation = (async () => {
      const { port } = await session.ready;
      await sendCancellation(port, { requestId: session.requestId });
    })();
    try {
      await session.cancellation;
    } catch (error) {
      session.cancelled = false;
      session.cancellation = undefined;
      throw error;
    }
    return;
  }

  const port = await findPluginBridgePort();
  if (!port) throw new Error('The desktop connection is unavailable.');
  const health = await readStudioHealth();
  if (!health.scanStatus?.scanning) return;
  await sendCancellation(port, {
    requestId: health.scanRequestId || undefined,
    scanId: health.scanId || undefined,
  });
}
