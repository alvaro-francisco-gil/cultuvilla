import { describe, expect, it, jest } from '@jest/globals';
import { tripleClickSelectAll } from '../tripleClickSelectAll';

function fakeField(value: string) {
  return { value, setSelectionRange: jest.fn<(start: number, end: number) => void>() };
}

describe('tripleClickSelectAll', () => {
  it('selects the whole field on the third click and reports the range', () => {
    const field = fakeField('hola\nmundo');
    const onSelect = jest.fn();
    tripleClickSelectAll(field, onSelect)({ detail: 3 });
    expect(field.setSelectionRange).toHaveBeenCalledWith(0, 10);
    expect(onSelect).toHaveBeenCalledWith({ start: 0, end: 10 });
  });

  it('leaves single and double clicks to the browser', () => {
    const field = fakeField('hola');
    const onSelect = jest.fn();
    const handler = tripleClickSelectAll(field, onSelect);
    handler({ detail: 1 });
    handler({ detail: 2 });
    expect(field.setSelectionRange).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
