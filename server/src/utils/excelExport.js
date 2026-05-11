import ExcelJS from 'exceljs';

const MONTHS = [
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

function safeCellValue(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function formatExportDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function autoAdjustColumnWidths(sheet) {
  sheet.columns.forEach((column) => {
    let maxLength = 0;

    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = safeCellValue(cell.value);
      maxLength = Math.max(maxLength, value.length);
    });

    column.width = Math.max(maxLength + 2, 12);
  });
}

function sortExportRows(rows) {
  return [...rows].sort((first, second) => {
    const firstName = safeCellValue(first?.employeeName).toLocaleLowerCase();
    const secondName = safeCellValue(second?.employeeName).toLocaleLowerCase();
    const nameComparison = firstName.localeCompare(secondName);

    if (nameComparison !== 0) return nameComparison;

    return safeCellValue(first?.employeeId).localeCompare(safeCellValue(second?.employeeId));
  });
}

export function createAttendanceWorkbook(rows = [], options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance App';
  workbook.created = new Date();

  const sessionColumns = Array.isArray(options.sessions) && options.sessions.length > 0
    ? options.sessions.map((session) => ({
      header: formatExportDate(session.startDateTime || session.sessionDate),
      key: `session_${session.id}`,
      width: 18
    }))
    : [{
      header: formatExportDate(options.exportDate),
      key: 'attendanceStatus',
      width: 18
    }];

  const sheet = workbook.addWorksheet('Attendance');
  sheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 18 },
    { header: 'Employee Name', key: 'employeeName', width: 30 },
    ...sessionColumns
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF2F8' }
  };

  sortExportRows(rows).forEach((attendance) => {
    sheet.addRow({
      employeeId: safeCellValue(attendance?.employeeId),
      employeeName: safeCellValue(attendance?.employeeName),
      attendanceStatus: safeCellValue(attendance?.attendanceStatus),
      ...attendance?.sessionStatuses
    });
  });

  autoAdjustColumnWidths(sheet);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
}
