'use client';

import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { TextAreaField } from './Field';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** Bila diisi, user wajib mengetik alasan sebelum tombol konfirmasi aktif. */
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  destructive = false,
  loading = false,
  reasonLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const needsReason = Boolean(reasonLabel);
  const canConfirm = !loading && (!needsReason || reason.trim().length > 0);

  function close() {
    setReason('');
    onCancel();
  }

  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={close}
      disableBackdropClose={needsReason}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            disabled={!canConfirm}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-ink-muted">{message}</div>
        {reasonLabel && (
          <TextAreaField
            label={reasonLabel}
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: salah input jumlah produk"
          />
        )}
      </div>
    </Modal>
  );
}
