import type { QsoEntry } from '../types';
import { formatSerial } from '../utils/cutNumbers';

interface LogDisplayProps {
  log: QsoEntry[];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getRowClass(entry: QsoEntry): string {
  if (entry.isDupe) return 'dupe';
  if (entry.isBustedExchange) return 'busted';
  if (entry.isMultiplier) return 'multiplier';
  return '';
}

export function LogDisplay({ log }: LogDisplayProps) {
  return (
    <div className="log-display">
      <h2>Log</h2>
      <div className="log-table-container">
        <table className="log-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Call</th>
              <th>Sent</th>
              <th>Rcvd</th>
              <th>Status</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>No QSOs logged yet</td>
              </tr>
            )}
            {log.map((entry, index) => (
              <tr key={entry.id} className={getRowClass(entry)}>
                <td>{log.length - index}</td>
                <td>{formatTime(entry.timestamp)}</td>
                <td className="call-col">{entry.call}</td>
                <td>{formatSerial(entry.sentSerial)}</td>
                <td className={entry.isBustedExchange ? 'busted-nr' : ''}>
                  {formatSerial(entry.rcvdSerial)}
                  {entry.isBustedExchange && (
                    <span className="correct-nr" title={`Should be ${entry.actualSerial}`}>
                      ({entry.actualSerial})
                    </span>
                  )}
                </td>
                <td className="status-col">
                  {entry.isDupe && <span className="status-badge dupe">DUP</span>}
                  {entry.isBustedExchange && !entry.isDupe && <span className="status-badge busted">NR?</span>}
                  {entry.isMultiplier && <span className="status-badge mult">{entry.prefix}</span>}
                </td>
                <td>{entry.verifiedPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
