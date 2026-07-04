import { fireEvent, render, screen } from '@testing-library/react-native';

import { Banner } from '@/components/Banner';

describe('Banner', () => {
  it('renders title and subtitle and fires onPress', () => {
    const onPress = jest.fn();
    render(
      <Banner
        icon="alert-triangle"
        title="VPN permission needed"
        subtitle="Tap to enable DNS filtering"
        trailing="chevron"
        onPress={onPress}
      />,
    );

    expect(screen.getByText('VPN permission needed')).toBeTruthy();
    expect(screen.getByText('Tap to enable DNS filtering')).toBeTruthy();

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a static, non-pressable banner when no onPress is given', () => {
    render(<Banner tone="success" icon="shield" subtitle="Protection is active." />);

    expect(screen.getByText('Protection is active.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
