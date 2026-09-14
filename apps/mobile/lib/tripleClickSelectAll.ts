export interface SelectableField {
  value: string;
  setSelectionRange: (start: number, end: number) => void;
}

/**
 * Click handler that selects a text field's whole value on a triple click.
 * Browsers select only the clicked paragraph on a triple click; the editor
 * wants the whole block so formatting can be applied to all of it at once.
 * `onSelect` reports the range, since a scripted selection doesn't reliably
 * re-emit RN-Web's onSelectionChange.
 */
export function tripleClickSelectAll(
  field: SelectableField,
  onSelect: (selection: { start: number; end: number }) => void,
): (event: { detail: number }) => void {
  return (event) => {
    if (event.detail !== 3) return;
    const end = field.value.length;
    field.setSelectionRange(0, end);
    onSelect({ start: 0, end });
  };
}
