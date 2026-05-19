import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pressable } from './Pressable';

describe('<Pressable>', () => {
  it('renders children inside a button by default', () => {
    render(<Pressable onPress={() => {}}>click</Pressable>);
    const el = screen.getByText('click');
    expect(el.tagName).toBe('BUTTON');
  });

  it('calls onPress when clicked', () => {
    const onPress = vi.fn();
    render(<Pressable onPress={onPress}>click</Pressable>);
    fireEvent.click(screen.getByText('click'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = vi.fn();
    render(<Pressable onPress={onPress} disabled>click</Pressable>);
    fireEvent.click(screen.getByText('click'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes a minimum 44px touch target via padding when smaller content is inside', () => {
    render(<Pressable onPress={() => {}} data-testid="p">x</Pressable>);
    expect(screen.getByTestId('p').className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByTestId('p').className).toMatch(/min-w-\[44px\]/);
  });
});
