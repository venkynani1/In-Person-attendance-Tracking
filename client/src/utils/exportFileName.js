function formatDateForFileName(value) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'date';

  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
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
  const sessions = Array.isArray(training?.sessions) ? training.sessions : [];
  const date = formatDateForFileName(sessions[0]?.startDateTime || training?.startDateTime);

  if (sessions.length > 1) {
    const endDate = formatDateForFileName(sessions[sessions.length - 1]?.startDateTime || training?.endDateTime);
    return `${trainingName}_${location}_${date}_to_${endDate}.xlsx`;
  }

  return `${trainingName}_${location}_${date}.xlsx`;
}
