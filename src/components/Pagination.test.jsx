import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Pagination from './Pagination.jsx';

describe('Pagination', () => {
  it('renders page count and item range', () => {
    render(
      <Pagination page={1} totalPages={3} setPage={() => {}} totalItems={25} pageSize={10} />
    );
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
  });

  it('calls setPage when a page button is clicked', () => {
    const setPage = vi.fn();
    render(
      <Pagination page={1} totalPages={3} setPage={setPage} totalItems={25} pageSize={10} />
    );
    fireEvent.click(screen.getByText('2'));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('disables Prev on first page', () => {
    render(
      <Pagination page={1} totalPages={3} setPage={() => {}} totalItems={25} pageSize={10} />
    );
    expect(screen.getByText('← Prev')).toBeDisabled();
  });

  it('returns null when totalPages is 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} setPage={() => {}} totalItems={5} pageSize={10} />
    );
    expect(container.firstChild).toBeNull();
  });
});
