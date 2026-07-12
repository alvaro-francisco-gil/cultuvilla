import { fireEvent, render } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { DeleteHeaderButton } from '../DeleteHeaderButton';

const props = {
  accessibilityLabel: 'Eliminar',
  confirmTitle: 'Eliminar',
  confirmMessage: '¿Seguro?',
  confirmLabel: 'Eliminar',
  cancelLabel: 'Cancelar',
  deletingLabel: 'Eliminando…',
};

describe('DeleteHeaderButton', () => {
  it('native: fires onConfirm when the destructive Alert button is pressed', () => {
    Platform.OS = 'ios';
    const onConfirm = jest.fn();
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, btns) => {
      btns?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const { getByLabelText } = render(<DeleteHeaderButton {...props} onConfirm={onConfirm} />);
    fireEvent.press(getByLabelText('Eliminar'));
    expect(spy).toHaveBeenCalledWith('Eliminar', '¿Seguro?', expect.any(Array));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('web: fires onConfirm only when window.confirm returns true', () => {
    Platform.OS = 'web';
    const onConfirm = jest.fn();
    // jsdom isn't loaded in this jest env, so window has no confirm to spy on —
    // install the mock directly.
    const confirm = jest.fn<boolean, [string?]>().mockReturnValue(false);
    (globalThis as unknown as { window: { confirm: typeof confirm } }).window = {
      ...(globalThis as unknown as { window?: object }).window,
      confirm,
    } as never;
    const { getByLabelText } = render(<DeleteHeaderButton {...props} onConfirm={onConfirm} />);
    fireEvent.press(getByLabelText('Eliminar'));
    expect(onConfirm).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.press(getByLabelText('Eliminar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
