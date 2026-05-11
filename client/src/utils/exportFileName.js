function formatDateForFileName(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'date';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function sanitizeFileNamePart(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '')
    .replace(/[^a-z0-9 _.-]+/gi, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');

  return cleaned || fallback;
}

export function buildAttendanceReportFileName(training) {
  const trainingName = sanitizeFileNamePart(training?.trainingName, 'Training');
  const location = sanitizeFileNamePart(training?.location, 'Location');
  const date = formatDateForFileName(training?.startDateTime);

  return `${trainingName}_${location}_${date}.xlsx`;
}
