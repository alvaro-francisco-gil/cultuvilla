import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('<Button>', () => {
  it('renders the label', () => {
    render(<Button onPress={() => {}}>Save</Button>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('fires onPress on click', () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save</Button>);
    fireEvent.click(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies primary variant by default', () => {
    render(<Button onPress={() => {}} data-testid="b">x</Button>);
    expect(screen.getByTestId('b').className).toMatch(/bg-accent/);
  });

  it('applies secondary variant class', () => {
    render(
      <Button variant="secondary" onPress={() => {}} data-testid="b">x</Button>,
    );
    expect(screen.getByTestId('b').className).toMatch(/bg-subtle/);
  });

  it('applies ghost variant class', () => {
    render(
      <Button variant="ghost" onPress={() => {}} data-testid="b">x</Button>,
    );
    expect(screen.getByTestId('b').className).toMatch(/bg-transparent/);
  });

  it('renders a loading indicator when loading', () => {
    render(
      <Button onPress={() => {}} loading data-testid="b">Save</Button>,
    );
    // The label is replaced with a "…" while loading; the button is
    // also disabled to prevent double-submits.
    expect(screen.getByTestId('b').textContent).toBe('…');
    expect(screen.getByTestId('b')).toBeDisabled();
  });
});
