import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../components/Common';

describe('DataForge Frontend Component Suite', () => {
  it('renders EmptyState with action button correctly', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No Datasets Found"
        description="Try registering a new dataset"
        actionText="Register Dataset"
        onAction={handleAction}
      />
    );

    expect(screen.getByText('No Datasets Found')).toBeDefined();
    expect(screen.getByText('Try registering a new dataset')).toBeDefined();
    const btn = screen.getByText('Register Dataset');
    expect(btn).toBeDefined();
    btn.click();
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});
