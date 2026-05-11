import ExcelJS from 'exceljs';

function safeCellValue(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function formatTrainingDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${year}-${month}-${day}`;
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

export function createAttendanceWorkbook(attendances = [], options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance App';
  workbook.created = new Date();

  const trainingDate = formatTrainingDate(options.trainingDate);
  const headers = ['Emp ID', 'Emp Name', trainingDate || 'Training Date'];

  const sheet = workbook.addWorksheet('Attendance');
  sheet.addRow(headers);

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF2F8' }
  };

  sortExportRows(attendances).forEach((attendance) => {
    sheet.addRow([
      safeCellValue(attendance?.employeeId),
      safeCellValue(attendance?.employeeName),
      safeCellValue(attendance?.status)
    ]);
  });

  autoAdjustColumnWidths(sheet);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
}
