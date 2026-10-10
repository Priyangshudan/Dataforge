import React from 'react';
import { Loader2, AlertCircle, Inbox, CheckCircle2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading DataForge assets...' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', gap: '16px' }}>
    <Loader2 size={36} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
    <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>{message}</span>
    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = 'Failed to load data', message, onRetry }) => (
  <div style={{
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    border: '1px solid rgba(244, 63, 94, 0.3)',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    margin: '16px 0',
  }}>
    <AlertCircle size={24} color="var(--accent-rose)" style={{ flexShrink: 0, marginTop: '2px' }} />
    <div style={{ flex: 1 }}>
      <h4 style={{ color: 'var(--accent-rose)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{title}</h4>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '14px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Try Again
        </button>
      )}
    </div>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}> = ({ title, description, actionText, onAction, icon }) => (
  <div style={{
    textAlign: 'center',
    padding: '64px 24px',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    margin: '20px 0',
  }}>
    <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', marginBottom: '16px' }}>
      {icon || <Inbox size={32} />}
    </div>
    <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>{title}</h3>
    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '420px', margin: '0 auto 20px auto' }}>{description}</p>
    {actionText && onAction && (
      <button
        onClick={onAction}
        style={{
          backgroundColor: 'var(--accent-cyan)',
          color: '#FFFFFF',
          padding: '8px 18px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        {actionText}
      </button>
    )}
  </div>
);

export const ToastNotification: React.FC<{
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}> = ({ type, message, onClose }) => (
  <div style={{
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    backgroundColor: type === 'success' ? '#064E3B' : '#881337',
    border: `1px solid ${type === 'success' ? '#10B981' : '#F43F5E'}`,
    color: '#F8FAFC',
    padding: '12px 20px',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    zIndex: 9999,
    fontSize: '14px',
    fontWeight: 500,
  }}>
    {type === 'success' ? <CheckCircle2 size={18} color="#34D399" /> : <AlertCircle size={18} color="#FDA4AF" />}
    <span>{message}</span>
    <button onClick={onClose} style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '18px', lineHeight: 1 }}>&times;</button>
  </div>
);

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}> = ({ isOpen, onClose, title, children, width = '600px' }) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(3, 7, 18, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5000,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: width,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
      }}>
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)', fontSize: '20px' }}>&times;</button>
        </div>
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

