import { render, screen } from '@testing-library/react-native';

import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  it('renders the title and optional subtitle', () => {
    render(<EmptyState icon="book-open" title="No entries yet" subtitle="They will appear here." />);

    expect(screen.getByText('No entries yet')).toBeTruthy();
    expect(screen.getByText('They will appear here.')).toBeTruthy();
  });

  it('omits the subtitle when not provided', () => {
    render(<EmptyState icon="bell" title="All caught up" />);

    expect(screen.getByText('All caught up')).toBeTruthy();
    expect(screen.queryByText('They will appear here.')).toBeNull();
  });
});
