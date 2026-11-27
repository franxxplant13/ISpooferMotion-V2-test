import { beforeEach, describe, expect, mock, test } from 'bun:test';

const health = mock(async (): Promise<Record<string, unknown>> => ({}));
const request = mock(async (_path: string, _port: string, _init?: RequestInit) =>
  Response.json({ success: true }),
);
mock.module('@tauri-apps/api/core', () => ({ invoke: health }));
mock.module('../src/utils/debugLogger', () => ({ addDebugLog: mock() }));
mock.module('../src/utils/pluginBridge', () => ({
  findPluginBridgePort: async () => '14285',
  fetchPluginBridge: request,
}));
const { triggerStudioScan, cancelStudioScan, StudioScanCancelled } =
  await import('../src/utils/studioScan');

beforeEach(() => {
  health.mockReset();
  request.mockReset();
  request.mockImplementation(async () => Response.json({ success: true }));
});

describe('Studio scan requests', () => {
  test('starts all selected types atomically and preserves the scan path', async () => {
    health.mockResolvedValueOnce({ scanGeneration: 0 });
    health.mockResolvedValue({ scanGeneration: 1, completedScanGeneration: 1 });
    await triggerStudioScan({ scanTypes: ['animations', 'sounds'], scanPath: 'Workspace.Rig' });
    expect(request).toHaveBeenCalledTimes(1);
    const [path, , init] = request.mock.calls[0];
    expect(path).toBe('/request-scan');
    expect(JSON.parse(init!.body as string)).toMatchObject({
      scanTypes: ['animations', 'sounds'],
      scanPath: 'Workspace.Rig',
    });
  });

  test('cancel during startup waits for the accepted request and targets its identity', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    health.mockImplementation(async () => {
      await gate;
      return { scanGeneration: 0 };
    });
    const run = triggerStudioScan({ scanTypes: ['animations'] });
    const stopped = run.catch((error: unknown) => error);
    const cancel = cancelStudioScan();
    release();
    await cancel;
    expect(await stopped).toBeInstanceOf(StudioScanCancelled);
    expect(request.mock.calls.map((call) => call[0])).toEqual(['/request-scan', '/cancel-scan']);
    const start = JSON.parse(request.mock.calls[0][2]!.body as string);
    const stop = JSON.parse(request.mock.calls[1][2]!.body as string);
    expect(stop.requestId).toBe(start.requestId);
  });

  test('cancel after a reload targets the active plugin scan', async () => {
    health.mockResolvedValue({
      scanStatus: { scanning: true },
      scanId: 'plugin-scan',
    });
    await cancelStudioScan();
    expect(request.mock.calls[0][0]).toBe('/cancel-scan');
    expect(JSON.parse(request.mock.calls[0][2]!.body as string)).toEqual({ scanId: 'plugin-scan' });
  });

  test('empty type selections do not start a scan', async () => {
    health.mockResolvedValue({ scanGeneration: 0 });
    await expect(triggerStudioScan({ scanTypes: [] })).rejects.toThrow('Select at least one');
    expect(request).not.toHaveBeenCalled();
  });
});
