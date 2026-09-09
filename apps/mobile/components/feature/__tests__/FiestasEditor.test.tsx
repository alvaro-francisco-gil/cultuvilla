import { useState } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FiestasEditor } from '../FiestasEditor';
import type { FiestaBlock } from '@cultuvilla/shared/models/municipality/FiestaBlockModel';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
// The date picker is native-heavy; stub it down to a button that emits a date.
jest.mock('../../primitives/DateField', () => ({
  DateField: ({ label, value, onChange, testID }: any) => {
    const { Text, Pressable } = require('react-native');
    return (
      <Pressable testID={testID} onPress={() => onChange(new Date('2026-08-30T00:00:00+02:00'))}>
        <Text>{`${label}:${value ? (value as Date).toISOString() : 'null'}`}</Text>
      </Pressable>
    );
  },
}));

const agosto: FiestaBlock = {
  id: 'agosto',
  name: 'Fiestas de agosto',
  anchor: { month: 8, day: 23, days: 6 },
  years: {},
};

/** Wraps the controlled editor so edits round-trip like they do in the screen. */
function Harness({ initial, onChange }: { initial: FiestaBlock[]; onChange: jest.Mock }) {
  const [blocks, setBlocks] = useState(initial);
  return (
    <FiestasEditor
      blocks={blocks}
      year={2026}
      onChange={(next) => {
        setBlocks(next);
        onChange(next);
      }}
    />
  );
}

describe('FiestasEditor', () => {
  it('adds a block from a typed name, with a slug id', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[]} onChange={onChange} />);
    fireEvent.changeText(getByTestId('fiesta-new-name'), 'Fiestas de Agosto');
    fireEvent.press(getByTestId('fiesta-add'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ id: 'fiestas-de-agosto', name: 'Fiestas de Agosto' });
  });

  it('does not add a block for a blank name', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[]} onChange={onChange} />);
    fireEvent.changeText(getByTestId('fiesta-new-name'), '   ');
    fireEvent.press(getByTestId('fiesta-add'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a block', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[agosto]} onChange={onChange} />);
    fireEvent.press(getByTestId('fiesta-remove-agosto'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  // The reported bug: persisting each keystroke wrote name: '' on a clear, and
  // a municipality is read through a strict converter.
  it('never persists an empty name while typing', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[agosto]} onChange={onChange} />);
    fireEvent.changeText(getByTestId('fiesta-agosto-name'), '');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reverts to the saved name when the field is left empty', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[agosto]} onChange={onChange} />);
    const input = getByTestId('fiesta-agosto-name');
    fireEvent.changeText(input, '');
    fireEvent(input, 'blur');
    expect(onChange).not.toHaveBeenCalled();
    expect(getByTestId('fiesta-agosto-name').props.value).toBe('Fiestas de agosto');
  });

  it('commits a renamed block on blur, trimmed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[agosto]} onChange={onChange} />);
    const input = getByTestId('fiesta-agosto-name');
    fireEvent.changeText(input, '  Fiestas grandes  ');
    fireEvent(input, 'blur');
    expect(onChange.mock.calls[0][0][0].name).toBe('Fiestas grandes');
  });

  it('keeps the id stable across a rename, since it keys the Wrapped', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[agosto]} onChange={onChange} />);
    const input = getByTestId('fiesta-agosto-name');
    fireEvent.changeText(input, 'Otro nombre');
    fireEvent(input, 'blur');
    expect(onChange.mock.calls[0][0][0].id).toBe('agosto');
  });

  it('edits the anchor month and clamps an impossible day', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[{ ...agosto, anchor: { month: 8, day: 31, days: 1 } }]} onChange={onChange} />);
    fireEvent.press(getByTestId('fiesta-agosto-month-2'));
    expect(onChange.mock.calls[0][0][0].anchor).toMatchObject({ month: 2, day: 29 });
  });

  it('never steps the anchor below one day', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[{ ...agosto, anchor: { month: 8, day: 1, days: 1 } }]} onChange={onChange} />);
    fireEvent.press(getByTestId('fiesta-agosto-days-minus'));
    expect(onChange.mock.calls[0][0][0].anchor.days).toBe(1);
  });

  it('confirming a year materializes the anchor into exact dates', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[agosto]} onChange={onChange} />);
    fireEvent(getByTestId('fiesta-agosto-confirm'), 'valueChange', true);
    const years = onChange.mock.calls[0][0][0].years;
    expect(Object.keys(years)).toEqual(['2026']);
    expect(years['2026'].start.toISOString()).toBe('2026-08-22T22:00:00.000Z');
  });

  it('unconfirming a year drops that year only', () => {
    const withYears: FiestaBlock = {
      ...agosto,
      years: {
        2025: { start: new Date('2025-08-23'), end: new Date('2025-08-28') },
        2026: { start: new Date('2026-08-23'), end: new Date('2026-08-28') },
      },
    };
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[withYears]} onChange={onChange} />);
    fireEvent(getByTestId('fiesta-agosto-confirm'), 'valueChange', false);
    expect(Object.keys(onChange.mock.calls[0][0][0].years)).toEqual(['2025']);
  });

  it('refuses a start date later than the end, rather than persisting an invalid window', () => {
    const withYear: FiestaBlock = {
      ...agosto,
      years: { 2026: { start: new Date('2026-08-23T00:00:00+02:00'), end: new Date('2026-08-25T00:00:00+02:00') } },
    };
    const onChange = jest.fn();
    const { getByTestId } = render(<Harness initial={[withYear]} onChange={onChange} />);
    // The stubbed picker emits 30 August, which is after the 25 August end.
    fireEvent.press(getByTestId('fiesta-agosto-start'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the approximate window while a year is unconfirmed', async () => {
    const { queryByText } = render(<Harness initial={[agosto]} onChange={jest.fn()} />);
    await waitFor(() => expect(queryByText(/village.fiestas.approximate/)).toBeTruthy());
  });
});
