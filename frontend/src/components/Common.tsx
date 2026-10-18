import React, { useEffect, useState } from 'react';
import {
  Loader2,
  AlertTriangle,
  Inbox,
  CheckCircle2,
  Copy,
  Check,
  X,
  Clock,
  XCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export function formatBytes(bytes: number | string | undefined | null): string {
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : Number(bytes || 0);
  if (isNaN(b) || b <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const LoadingSpinner: React.FC<{ message?: string }> = ({
  message = 'Synchronizing with DataForge PostgreSQL engine...',
}) => (
  <div
    role="status"
    aria-live="polite"
    className="df-panel"
    style={{
      alignItems: 'center',
      justifyContent: 'center',
      padding: '56px 24px',
      gap: '18px',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'var(--accent-lime-dim)',
        border: '1px solid var(--accent-lime-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Loader2
        size={22}
        color="var(--accent-lime)"
        style={{ animation: 'df-spin 1s linear infinite' }}
      />
    </div>
    <div>
      <div
        className="font-display"
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '0.05em',
        }}
      >
        QUERYING REPOSITORY
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
        {message}
      </p>
    </div>
    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
      {[72, 110, 64].map((w, idx) => (
        <div
          key={idx}
          style={{
            width: `${w}px`,
            height: '6px',
            borderRadius: '999px',
            backgroundColor: idx === 1 ? 'var(--accent-lime)' : 'var(--bg-elevated)',
            animation: 'df-pulse 1.4s ease-in-out infinite',
            animationDelay: `${idx * 180}ms`,
          }}
        />
      ))}
    </div>
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
}> = ({ title = 'Database / API Request Failed', message, code, onRetry }) => (
  <div
    role="alert"
    className="df-panel"
    style={{
      borderColor: 'var(--accent-amber-border)',
      backgroundColor: 'var(--bg-surface)',
      padding: '28px',
      margin: '12px 0',
    }}
  >
    <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-amber-dim)',
          border: '1px solid var(--accent-amber-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={20} color="var(--accent-amber)" />
      </div>
      <div style={{ flex: 1, minWidth: '240px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <h4
            className="font-display"
            style={{
              color: 'var(--accent-amber)',
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            {title}
          </h4>
          {code && (
            <span
              className="font-mono"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {code}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-primary)', fontSize: '13.5px', lineHeight: 1.55 }}>
          {message}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px' }}>
          Ensure the Express API server (`http://localhost:5000`) and PostgreSQL instance (`dataforge`) are running and reachable. No fabricated fallback data is substituted.
        </p>
        {onRetry && (
          <div style={{ marginTop: '16px' }}>
            <button onClick={onRetry} className="df-btn df-btn-amber">
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionText?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}> = ({ title, description, actionText, actionLabel, onAction, icon }) => {
  const buttonLabel = actionText || actionLabel;
  return (
    <div
      className="df-panel"
      style={{
        textAlign: 'center',
        padding: '56px 24px',
        borderStyle: 'dashed',
        borderColor: 'var(--border-strong)',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '12px 0',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--accent-lime)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        {icon || <Inbox size={26} />}
      </div>
      <h3
        className="font-display"
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '6px',
          letterSpacing: '0.04em',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '13.5px',
          maxWidth: '440px',
          margin: '0 auto 22px auto',
        }}
      >
        {description}
      </p>
      {buttonLabel && onAction && (
        <button onClick={onAction} className="df-btn df-btn-lime">
          {buttonLabel}
        </button>
      )}
    </div>
  );
};

export const ToastNotification: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose: () => void;
}> = ({ type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = type === 'success' || type === 'info';
  const accentColor = isSuccess ? 'var(--accent-lime)' : 'var(--accent-amber)';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${accentColor}`,
        color: 'var(--text-primary)',
        padding: '12px 18px',
        borderRadius: 'var(--radius-pill)',
        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 9999,
        fontSize: '13px',
        fontWeight: 600,
        maxWidth: '480px',
      }}
    >
      {isSuccess ? (
        <CheckCircle2 size={18} color="var(--accent-lime)" style={{ flexShrink: 0 }} />
      ) : (
        <AlertTriangle size={18} color="var(--accent-amber)" style={{ flexShrink: 0 }} />
      )}
      <span style={{ lineHeight: 1.4 }}>{message}</span>
      <button
        onClick={onClose}
        aria-label="Close notification"
        style={{
          color: 'var(--text-muted)',
          marginLeft: '6px',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}> = ({ isOpen, onClose, title, subtitle, children, width = '580px' }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 10, 9, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5000,
        padding: '16px',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 28px 60px rgba(0, 0, 0, 0.85)',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <h3
              className="font-display"
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.04em',
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="df-icon-circle"
            style={{ width: '34px', height: '34px', backgroundColor: 'var(--bg-card)' }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
};

export interface LegendItem {
  label: string;
  color: 'lime' | 'amber' | 'white' | 'muted' | 'gray';
}

export const RingLegend: React.FC<{
  items?: LegendItem[];
  label?: string;
  color?: LegendItem['color'];
  totalLabel?: string;
  totalValue?: string | number;
}> = ({ items, label, color = 'lime', totalLabel = 'Total', totalValue }) => {
  const getColor = (c: LegendItem['color']) => {
    switch (c) {
      case 'lime':
        return 'var(--accent-lime)';
      case 'amber':
        return 'var(--accent-amber)';
      case 'white':
        return 'var(--text-primary)';
      default:
        return 'var(--text-muted)';
    }
  };

  if (label && !items) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          fontSize: '11.5px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}
      >
        <span className="df-ring-dot" style={{ color: getColor(color) }} />
        <span>{label}</span>
      </span>
    );
  }

  const resolvedItems = items || [];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        paddingTop: '18px',
        marginTop: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {resolvedItems.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            <span className="df-ring-dot" style={{ color: getColor(item.color) }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      {totalValue !== undefined && (
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          {totalLabel}:{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{totalValue}</strong>
        </div>
      )}
    </div>
  );
};

export const Panel: React.FC<{
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  legend?: LegendItem[];
  totalLabel?: string;
  totalValue?: string | number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  flush?: boolean;
}> = ({
  title,
  subtitle,
  rightSlot,
  legend,
  totalLabel,
  totalValue,
  children,
  style,
  flush = false,
}) => (
  <section className={`df-panel ${flush ? 'df-panel-flush' : ''}`} style={style}>
    {(title || subtitle || rightSlot) && (
      <div
        className="df-panel-header"
        style={flush ? { padding: '22px 24px 0 24px' } : undefined}
      >
        <div>
          {title && <h3 className="df-panel-title">{title}</h3>}
          {subtitle && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {subtitle}
            </p>
          )}
        </div>
        {rightSlot ? (
          <div>{rightSlot}</div>
        ) : (
          <span
            aria-hidden="true"
            style={{
              color: 'var(--text-secondary)',
              letterSpacing: '2px',
              fontSize: '14px',
              fontWeight: 700,
              userSelect: 'none',
            }}
          >
            •••
          </span>
        )}
      </div>
    )}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    {legend && (
      <div style={flush ? { padding: '0 24px 22px 24px' } : undefined}>
        <RingLegend items={legend} totalLabel={totalLabel} totalValue={totalValue} />
      </div>
    )}
  </section>
);

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  badge?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, badge, eyebrow, actions }) => {
  const pillText = badge || eyebrow;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '18px',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 className="df-page-title">{title}</h2>
          {pillText && (
            <span
              className="font-mono"
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--accent-lime)',
                border: '1px solid var(--accent-lime-border)',
              }}
            >
              {pillText}
            </span>
          )}
        </div>
        {subtitle && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '13.5px',
              marginTop: '6px',
              maxWidth: '680px',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
};

export const DeltaStat: React.FC<{
  direction?: 'up' | 'down' | 'neutral';
  value?: string | number;
  delta?: string | number;
  positive?: boolean;
  label: string;
  sublabel?: string;
  accent?: 'lime' | 'amber' | 'white';
}> = ({ direction, value, delta, positive, label, sublabel, accent }) => {
  const resolvedDirection =
    direction || (positive === false ? 'down' : 'up');
  const resolvedValue = value !== undefined ? value : delta;
  const resolvedAccent =
    accent || (resolvedDirection === 'up' ? 'lime' : resolvedDirection === 'down' ? 'amber' : 'white');
  const triangleColor =
    resolvedAccent === 'lime'
      ? 'var(--accent-lime)'
      : resolvedAccent === 'amber'
        ? 'var(--accent-amber)'
        : 'var(--text-primary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span
        aria-hidden="true"
        style={{
          color: triangleColor,
          fontSize: '12px',
          lineHeight: 1,
          marginBottom: '2px',
        }}
      >
        {resolvedDirection === 'down' ? '▼' : '▲'}
      </span>
      <div className="df-metric-number">{resolvedValue}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}
      </div>
      {sublabel && (
        <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};

export const StatusBadge: React.FC<{
  status: string;
  size?: 'sm' | 'md';
}> = ({ status, size = 'sm' }) => {
  const norm = (status || '').toUpperCase();

  let tone: 'lime' | 'amber' | 'danger' | 'neutral' = 'neutral';
  let IconComp: React.ElementType = Sparkles;

  if (
    [
      'COMPLETED',
      'ACTIVE',
      'VALID',
      'VALIDATED',
      'UP',
      'CONNECTED',
      'NONE',
      'LOW',
      'OWNER',
      'LATEST',
      'EXACT_MATCH',
      'HIGH_COMPATIBILITY',
    ].includes(norm)
  ) {
    tone = 'lime';
    IconComp = ShieldCheck;
  } else if (
    [
      'RUNNING',
      'PENDING',
      'PLANNED',
      'MODERATE',
      'WARNING',
      'CONTRIBUTOR',
      'DATA_ENGINEER',
      'UPDATE',
      'MODIFIED',
      'PARTIAL_OVERLAP',
    ].includes(norm)
  ) {
    tone = 'amber';
    IconComp = Clock;
  } else if (
    ['FAILED', 'HIGH', 'SUSPENDED', 'INACTIVE', 'ERROR', 'DELETE', 'DIVERGENT_SCHEMA'].includes(norm)
  ) {
    tone = 'danger';
    IconComp = XCircle;
  }

  const styles = {
    lime: {
      bg: 'var(--accent-lime-dim)',
      color: 'var(--accent-lime)',
      border: 'var(--accent-lime-border)',
    },
    amber: {
      bg: 'var(--accent-amber-dim)',
      color: 'var(--accent-amber)',
      border: 'var(--accent-amber-border)',
    },
    danger: {
      bg: 'var(--accent-danger-dim)',
      color: 'var(--accent-danger)',
      border: 'var(--accent-danger-border)',
    },
    neutral: {
      bg: 'var(--bg-card)',
      color: 'var(--text-primary)',
      border: 'var(--border)',
    },
  }[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: size === 'sm' ? '3px 10px' : '5px 12px',
        borderRadius: 'var(--radius-pill)',
        backgroundColor: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <IconComp size={size === 'sm' ? 11 : 13} />
      <span>{status}</span>
    </span>
  );
};

export const HashBadge: React.FC<{
  hash: string;
  prefix?: string;
  chars?: number;
}> = ({ hash, prefix, chars = 12 }) => {
  const [copied, setCopied] = useState(false);

  if (!hash) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

  const display = hash.length > chars ? `${hash.slice(0, chars)}…` : hash;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy full identifier: ${hash}`}
      className="font-mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 9px',
        borderRadius: 'var(--radius-pill)',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: copied ? 'var(--accent-lime)' : 'var(--text-secondary)',
        fontSize: '11.5px',
        transition: 'all var(--transition-fast)',
      }}
    >
      {prefix && <span style={{ color: 'var(--text-muted)' }}>{prefix}: </span>}
      <span>{copied ? 'COPIED' : display}</span>
      {copied ? <Check size={11} color="var(--accent-lime)" /> : <Copy size={11} />}
    </button>
  );
};
