export function backupFilename(backup) {
  if (!['setup', 'data'].includes(backup.kind) || !['staging', 'production'].includes(backup.environment)) throw new Error('Invalid backup metadata.');
  const date = new Date(backup.createdAt);
  if (!Number.isFinite(date.getTime()) || typeof backup.sql !== 'string' || !backup.sql.startsWith('-- Bridges Manufacturing')) throw new Error('The server returned an incomplete backup.');
  return `bridges-${backup.environment}-${backup.kind}-${date.toISOString().replace(/[:.]/g, '-')}.sql`;
}

export function downloadBackup(backup) {
  const filename = backupFilename(backup);
  const blob = new Blob([backup.sql], { type: 'application/sql;charset=utf-8' });
  if (blob.size !== backup.bytes) throw new Error('Backup size validation failed. Please try again.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return filename;
}
