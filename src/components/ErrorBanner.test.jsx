import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBanner from './ErrorBanner.jsx';

describe('ErrorBanner', () => {
  it('renders the error message', () => {
    render(<ErrorBanner message="Network error" onRetry={() => {}} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders without retry button when onRetry is not provided', () => {
    render(<ErrorBanner message="Error" />);
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });
});
