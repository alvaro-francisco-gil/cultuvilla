import { useState } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SignupFieldsEditor } from '../SignupFieldsEditor';
import type { SignupFieldSpec } from '@cultuvilla/shared/models/event/SignupFieldModel';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

/** The editor is controlled, so drive it through a stateful host. */
function Host({
  initial = [],
  lockedCount = 0,
  onValue,
}: {
  initial?: SignupFieldSpec[];
  lockedCount?: number;
  onValue: (next: SignupFieldSpec[]) => void;
}) {
  const [value, setValue] = useState<SignupFieldSpec[]>(initial);
  return (
    <SignupFieldsEditor
      value={value}
      lockedCount={lockedCount}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

const field = (over: Partial<SignupFieldSpec> = {}): SignupFieldSpec => ({
  id: 'f1',
  label: 'Talla',
  type: 'text',
  required: false,
  options: [],
  ...over,
});

describe('SignupFieldsEditor', () => {
  it('adds a field with a generated id and edits its label', () => {
    const onValue = jest.fn();
    const { getByTestId } = render(<Host onValue={onValue} />);

    fireEvent.press(getByTestId('signup-field-add'));
    const added = onValue.mock.calls[0]?.[0] as SignupFieldSpec[];
    expect(added).toHaveLength(1);
    expect(added[0]?.id).toBeTruthy();
    expect(added[0]?.type).toBe('text');

    fireEvent.changeText(getByTestId('signup-field-label-0'), 'Talla de camiseta');
    const labelled = onValue.mock.calls.at(-1)?.[0] as SignupFieldSpec[];
    expect(labelled[0]?.label).toBe('Talla de camiseta');
  });

  it('removes a field', () => {
    const onValue = jest.fn();
    const { getByTestId } = render(
      <Host initial={[field({ id: 'a' }), field({ id: 'b' })]} onValue={onValue} />,
    );
    fireEvent.press(getByTestId('signup-field-remove-0'));
    expect((onValue.mock.calls.at(-1)?.[0] as SignupFieldSpec[]).map((f) => f.id)).toEqual(['b']);
  });

  it('collects options for a select and drops them when the type changes', () => {
    const onValue = jest.fn();
    const { getByTestId } = render(<Host initial={[field({ type: 'select' })]} onValue={onValue} />);

    fireEvent.changeText(getByTestId('signup-field-option-input-0'), 'M');
    fireEvent.press(getByTestId('signup-field-option-add-0'));
    expect((onValue.mock.calls.at(-1)?.[0] as SignupFieldSpec[])[0]?.options).toEqual(['M']);

    // A stale option list on a re-typed field would be dead data.
    fireEvent.press(getByTestId('signup-field-type-0-number'));
    const retyped = (onValue.mock.calls.at(-1)?.[0] as SignupFieldSpec[])[0];
    expect(retyped?.type).toBe('number');
    expect(retyped?.options).toEqual([]);
  });

  it('does not add a duplicate or blank option', () => {
    const onValue = jest.fn();
    const { getByTestId } = render(
      <Host initial={[field({ type: 'select', options: ['M'] })]} onValue={onValue} />,
    );
    fireEvent.press(getByTestId('signup-field-option-add-0')); // empty draft
    fireEvent.changeText(getByTestId('signup-field-option-input-0'), 'M');
    fireEvent.press(getByTestId('signup-field-option-add-0')); // duplicate
    expect(onValue).not.toHaveBeenCalled();
  });

  it('locks removal and retyping of fields that already have collected answers', () => {
    const onValue = jest.fn();
    const { queryByTestId, getByTestId } = render(
      <Host initial={[field({ id: 'a' }), field({ id: 'b' })]} lockedCount={1} onValue={onValue} />,
    );
    // Locked row: no delete affordance, and the type chips are inert.
    expect(queryByTestId('signup-field-remove-0')).toBeNull();
    fireEvent.press(getByTestId('signup-field-type-0-date'));
    expect(onValue).not.toHaveBeenCalled();

    // The row added after the lock point is still fully editable.
    expect(getByTestId('signup-field-remove-1')).toBeTruthy();
  });

  it('still allows relabelling a locked field', () => {
    const onValue = jest.fn();
    const { getByTestId } = render(
      <Host initial={[field({ id: 'a' })]} lockedCount={1} onValue={onValue} />,
    );
    fireEvent.changeText(getByTestId('signup-field-label-0'), 'Talla (camiseta)');
    expect((onValue.mock.calls.at(-1)?.[0] as SignupFieldSpec[])[0]?.label).toBe('Talla (camiseta)');
  });
});
