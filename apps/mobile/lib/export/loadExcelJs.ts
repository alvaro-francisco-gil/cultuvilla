import type ExcelJS from 'exceljs';

/**
 * Deferred ExcelJS load. Kept in its own module for two reasons: the dynamic
 * import keeps ~1MB of zip/xml machinery out of the initial web bundle, and it
 * gives the workbook builder a seam that jest can substitute — jest can't
 * execute `import()` without --experimental-vm-modules, so a test swaps this
 * module for a static require of the real library.
 */
export async function loadExcelJs(): Promise<typeof ExcelJS> {
  return (await import('exceljs')).default;
}
