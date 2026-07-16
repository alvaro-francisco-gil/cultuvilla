import { describe, expect, it } from '@jest/globals';
import { markFontClasses, decorationStyle, markPresentation } from '../markStyle';

describe('markFontClasses', () => {
  it('maps only bold/italic to classes', () => {
    expect(markFontClasses(['bold', 'italic'])).toBe('font-bold italic');
    // underline/strikethrough are decoration, not font classes
    expect(markFontClasses(['underline', 'strikethrough'])).toBe('');
  });
  it('is empty for no marks', () => {
    expect(markFontClasses(undefined)).toBe('');
  });
});

describe('decorationStyle', () => {
  it('returns undefined when neither is set', () => {
    expect(decorationStyle(false, false)).toBeUndefined();
  });
  it('renders each decoration', () => {
    expect(decorationStyle(true, false)).toEqual({ textDecorationLine: 'underline' });
    expect(decorationStyle(false, true)).toEqual({ textDecorationLine: 'line-through' });
  });
  it('combines underline and strikethrough', () => {
    expect(decorationStyle(true, true)).toEqual({ textDecorationLine: 'underline line-through' });
  });
});

describe('markPresentation', () => {
  it('underlines a link/mention run even with no underline mark', () => {
    expect(markPresentation([], true)).toEqual({ className: '', style: { textDecorationLine: 'underline' } });
  });
  it('adds strikethrough over a link, composing with the link underline', () => {
    expect(markPresentation(['strikethrough'], true)).toEqual({
      className: '',
      style: { textDecorationLine: 'underline line-through' },
    });
  });
  it('renders a plain strikethrough run without underline', () => {
    expect(markPresentation(['strikethrough'], false)).toEqual({
      className: '',
      style: { textDecorationLine: 'line-through' },
    });
  });
  it('carries bold/italic as classes alongside decoration', () => {
    expect(markPresentation(['bold', 'underline'], false)).toEqual({
      className: 'font-bold',
      style: { textDecorationLine: 'underline' },
    });
  });
});
