import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { RichText } from '../RichText';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('RichText external links', () => {
  it('autolinks a bare URL and opens it with Linking.openURL', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const { getByText } = render(
      <RichText text="ir a https://x.com hoy" mentions={[]} links={[]} municipalityId="m1" />,
    );
    fireEvent.press(getByText('https://x.com'));
    expect(spy).toHaveBeenCalledWith('https://x.com');
    spy.mockRestore();
  });

  it('renders a custom-text link that opens its url', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const { getByText } = render(
      <RichText
        text="entradas aquí"
        mentions={[]}
        links={[{ url: 'https://tickets.example.com', offset: 9, length: 4 }]}
        municipalityId="m1"
      />,
    );
    fireEvent.press(getByText('aquí'));
    expect(spy).toHaveBeenCalledWith('https://tickets.example.com');
    spy.mockRestore();
  });

  it('keeps a bold custom-text link tappable', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const { getByText } = render(
      <RichText
        text="entradas aquí"
        mentions={[]}
        links={[{ url: 'https://tickets.example.com', offset: 9, length: 4 }]}
        marks={[{ type: 'bold', offset: 9, length: 4 }]}
        municipalityId="m1"
      />,
    );
    fireEvent.press(getByText('aquí'));
    expect(spy).toHaveBeenCalledWith('https://tickets.example.com');
    spy.mockRestore();
  });

  it('renders a formatted run as its own text node', () => {
    const { getByText } = render(
      <RichText
        text="hola mundo"
        mentions={[]}
        links={[]}
        marks={[{ type: 'italic', offset: 5, length: 5 }]}
        municipalityId="m1"
      />,
    );
    // "mundo" is split into its own italic run, so it is a distinct text node.
    expect(getByText('mundo')).toBeTruthy();
  });

  it('does not make an unsafe-scheme span pressable', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const { getByText } = render(
      <RichText
        text="click me"
        mentions={[]}
        links={[{ url: 'javascript:alert(1)', offset: 0, length: 8 }]}
        municipalityId="m1"
      />,
    );
    fireEvent.press(getByText('click me'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
