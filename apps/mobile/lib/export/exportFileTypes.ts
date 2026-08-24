/**
 * What an export generator hands to `downloadFile`: text for CSV, raw bytes for
 * the .xlsx workbook. Deliberately narrower than the DOM's `BlobPart` — a
 * `Blob` has no meaning on the native side, which writes straight to the
 * filesystem.
 */
export type ExportFileData = string | ArrayBuffer;
