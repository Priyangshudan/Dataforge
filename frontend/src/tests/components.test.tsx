import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  EmptyState,
  ErrorState,
  StatusBadge,
  HashBadge,
  RingLegend,
  DeltaStat,
  Modal,
  formatBytes,
} from '../components/Common';

describe('DataForge Redesigned Design System & Component Suite', () => {
  it('renders EmptyState with actionLabel or actionText and invokes callback', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No Datasets Found"
        description="Try registering a new dataset"
        actionLabel="Register Dataset"
        onAction={handleAction}
      />
    );

    expect(screen.getByText('No Datasets Found')).toBeDefined();
    expect(screen.getByText('Try registering a new dataset')).toBeDefined();
    const btn = screen.getByText('Register Dataset');
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders ErrorState honestly when API is unreachable and triggers retry', () => {
    const handleRetry = vi.fn();
    render(
      <ErrorState
        message="PostgreSQL backend connection refused on /api"
        onRetry={handleRetry}
      />
    );

    expect(
      screen.getByText('PostgreSQL backend connection refused on /api')
    ).toBeDefined();
    const retryBtn = screen.getByText('Retry Connection');
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders StatusBadge with accessible text for healthy and warning states', () => {
    render(
      <div>
        <StatusBadge status="COMPLETED" />
        <StatusBadge status="MODIFIED" />
        <StatusBadge status="FAILED" />
      </div>
    );

    expect(screen.getByText('COMPLETED')).toBeDefined();
    expect(screen.getByText('MODIFIED')).toBeDefined();
    expect(screen.getByText('FAILED')).toBeDefined();
  });

  it('renders HashBadge with truncated monospace SHA-256 fingerprint', () => {
    render(
      <HashBadge
        hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        prefix="SHA-256"
      />
    );

    expect(screen.getByText(/SHA-256/)).toBeDefined();
    expect(screen.getByText(/e3b0c44298fc/)).toBeDefined();
  });

  it('renders RingLegend and DeltaStat with directional telemetry', () => {
    render(
      <div>
        <RingLegend label="CATALOG VELOCITY" color="lime" />
        <DeltaStat delta="+14.2%" positive label="vs baseline" />
      </div>
    );

    expect(screen.getByText('CATALOG VELOCITY')).toBeDefined();
    expect(screen.getByText(/14\.2%/)).toBeDefined();
    expect(screen.getByText('vs baseline')).toBeDefined();
  });

  it('renders Modal when open and closes on close button click', () => {
    const handleClose = vi.fn();
    render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="REGISTER DATASET"
        subtitle="Transactional CSV ingest"
      >
        <div>Modal Body Content</div>
      </Modal>
    );

    expect(screen.getByText('REGISTER DATASET')).toBeDefined();
    expect(screen.getByText('Modal Body Content')).toBeDefined();
    const closeBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('formats byte sizes accurately via formatBytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});
