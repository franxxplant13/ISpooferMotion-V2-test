import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useStudioConnectionState } from '../../contexts/StudioConnectionContext';
import { useSpooferStore } from '../../stores/spooferStore';
import { addDebugLog, getDebugLogs, subscribeDebugLogs } from '../../utils/debugLogger';
import { cancelStudioScan } from '../../utils/studioScan';
import { Button } from '../ui/button';

export function StudioScanProgress() {
  const { scanStatus } = useStudioConnectionState();
  const requested = useSpooferStore((state) => state.isScanningStudio);
  const downloading = useSpooferStore((state) => state.isSpoofing);
  const [logs, setLogs] = useState(getDebugLogs);
  const [expanded, setExpanded] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => subscribeDebugLogs(setLogs), []);
  const operationLogs = logs
    .filter((entry) =>
      /studio scan|download (failed|error|request|stream)|timed out processing asset/i.test(
        entry.message,
      ),
    )
    .slice(-100);
  const latestLogId = operationLogs.at(-1)?.id;
  useEffect(() => {
    if (expanded && follow.current && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [latestLogId, expanded]);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const scanning = requested || scanStatus?.scanning;
  if (!scanning && !downloading && operationLogs.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-border-subtle bg-bg-surface">
      <div className="flex items-center gap-3 px-4 py-2">
        {(scanning || downloading) && (
          <Loader2 size={16} className="shrink-0 animate-spin text-primary" />
        )}
        <div className="min-w-0 flex-1 text-xs">
          <p className="truncate" title={scanStatus?.current_object}>
            {scanning
              ? scanStatus?.phase || 'Waiting for Studio'
              : downloading
                ? 'Downloading / processing assets'
                : 'Scan and download log'}
            {scanStatus ? ` · ${scanStatus.scanned.toLocaleString()} objects checked` : ''}
            {scanStatus?.found !== undefined
              ? ` · ${scanStatus.found.toLocaleString()} reference records`
              : ''}
          </p>
          {error && <p className="text-red-500">{error}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide log' : 'Show log'}
        </Button>
        {scanning && (
          <Button
            variant="outline"
            size="sm"
            disabled={cancelling}
            onClick={async () => {
              setCancelling(true);
              setError('');
              try {
                await cancelStudioScan();
              } catch (cause) {
                const message = String(cause);
                setError(message);
                addDebugLog('error', [message]);
              } finally {
                setCancelling(false);
              }
            }}
          >
            {cancelling ? 'Cancelling…' : 'Cancel scan'}
          </Button>
        )}
      </div>
      {expanded && (
        <div
          ref={outputRef}
          className="max-h-40 overflow-y-auto border-t border-border-subtle px-4 py-2 font-mono text-xs select-text"
          onScroll={() => {
            const output = outputRef.current;
            if (output)
              follow.current = output.scrollHeight - output.scrollTop - output.clientHeight < 32;
          }}
          aria-label="Scan progress and download errors"
        >
          {operationLogs.length === 0 && (
            <p className="text-text-secondary">
              {scanning ? 'Waiting for progress from Studio…' : 'Download errors will appear here.'}
            </p>
          )}
          {operationLogs.map((entry) => (
            <p
              key={entry.id}
              className={
                entry.level === 'error'
                  ? 'whitespace-pre-wrap break-words text-red-400'
                  : 'whitespace-pre-wrap break-words text-text-secondary'
              }
            >
              [{entry.timestamp}] {entry.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
