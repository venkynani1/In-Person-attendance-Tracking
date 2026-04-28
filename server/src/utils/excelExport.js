import ExcelJS from 'exceljs';

const HEADERS = ['Employee ID', 'Employee Name'];

function safeCellValue(value) {
  if (value === undefined || value === null) return '';
  return String(value);
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

export function createAttendanceWorkbook(attendances = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance App';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attendance');
  sheet.addRow(HEADERS);

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF2F8' }
  };

  attendances.forEach((attendance) => {
    sheet.addRow([
      safeCellValue(attendance?.employeeId),
      safeCellValue(attendance?.employeeName)
    ]);
  });

  autoAdjustColumnWidths(sheet);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
}
