export function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function getSessionState(training, now = new Date()) {
  if (!training?.startDateTime || !training?.endDateTime) {
    return {
      key: 'closed',
      label: 'Closed',
      badgeClass: 'closed',
      targetTime: null
    };
  }

  const currentTime = now.getTime();
  const startsAt = new Date(training.startDateTime).getTime();
  const endsAt = new Date(training.endDateTime).getTime();

  if (currentTime < startsAt) {
    return {
      key: 'not-started',
      label: 'Not Started',
      badgeClass: 'not-started',
      targetTime: startsAt
    };
  }

  if (currentTime > endsAt) {
    return {
      key: 'closed',
      label: 'Closed',
      badgeClass: 'closed',
      targetTime: null
    };
  }

  return {
    key: 'active',
    label: 'Active',
    badgeClass: 'active',
    targetTime: endsAt
  };
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function getCountdownMessage(training, now = new Date()) {
  const state = getSessionState(training, now);

  if (state.key === 'closed') {
    return 'Attendance closed';
  }

  const duration = formatDuration(state.targetTime - now.getTime());
  if (state.key === 'not-started') {
    return `Attendance opens in ${duration}`;
  }

  return `Attendance closes in ${duration}`;
}

export function getSmartSummaryItems(training, attendeeCount, now = new Date()) {
  const state = getSessionState(training, now);
  const items = [];

  if (state.key === 'active') {
    items.push('This session is currently active.');
    items.push(`${attendeeCount} participant${attendeeCount === 1 ? '' : 's'} have marked attendance.`);
    const minutesLeft = Math.max(0, Math.ceil((state.targetTime - now.getTime()) / 60000));
    items.push(`Attendance window closes in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`);
  } else if (state.key === 'not-started') {
    items.push('This session has not started yet.');
    items.push(`${attendeeCount} participant${attendeeCount === 1 ? '' : 's'} have marked attendance.`);
    const minutesUntilOpen = Math.max(0, Math.ceil((state.targetTime - now.getTime()) / 60000));
    items.push(`Attendance window opens in ${minutesUntilOpen} minute${minutesUntilOpen === 1 ? '' : 's'}.`);
  } else {
    items.push(`Attendance is closed. Final count: ${attendeeCount} participant${attendeeCount === 1 ? '' : 's'}.`);
  }

  if (attendeeCount === 0) {
    items.push('No attendance recorded yet.');
  }

  return items;
}
