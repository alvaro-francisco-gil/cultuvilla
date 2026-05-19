import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from './Text';

describe('<Text>', () => {
  it('renders the body variant by default', () => {
    render(<Text>hello</Text>);
    const el = screen.getByText('hello');
    expect(el.className).toMatch(/text-body/);
  });

  it('applies the variant class', () => {
    render(<Text variant="h1">title</Text>);
    expect(screen.getByText('title').className).toMatch(/text-h1/);
  });

  it('applies the muted tone class', () => {
    render(<Text tone="muted">muted</Text>);
    expect(screen.getByText('muted').className).toMatch(/text-muted/);
  });

  it('uses the right HTML tag for headings', () => {
    render(<Text variant="h2">h2</Text>);
    const el = screen.getByText('h2');
    expect(el.tagName).toBe('H2');
  });

  it('uses <span> for non-heading variants', () => {
    render(<Text>body</Text>);
    expect(screen.getByText('body').tagName).toBe('SPAN');
  });
});
