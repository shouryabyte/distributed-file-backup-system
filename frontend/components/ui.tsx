import { AlertCircle, ArrowRight, CheckCircle2, Inbox, LoaderCircle } from 'lucide-react';
import Link from 'next/link';

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#087c80]">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[#142b3a] sm:text-[2.15rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6a7b87]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const colors = {
    good: 'border-[#c7ebe1] bg-[#e9f8f2] text-[#13775d]',
    warn: 'border-[#f5dfb4] bg-[#fff7e8] text-[#9b6914]',
    bad: 'border-[#f4d0cf] bg-[#fff0ef] text-[#b34646]',
    neutral: 'border-[#dce6e9] bg-[#f3f6f7] text-[#657784]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-[#f2d1ce] bg-[#fff2f0] p-4 text-sm text-[#a4433d]"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex gap-3 rounded-xl border border-[#bee7d6] bg-[#ecfaf3] p-4 text-sm text-[#1a7053]"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function LoadingBlock({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="surface flex min-h-56 items-center justify-center gap-3 text-sm text-[#758691]">
      <LoaderCircle className="h-5 w-5 animate-spin text-[#087c80]" /> {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-[#e8f4f3] p-4 text-[#087c80]">
        <Inbox className="h-7 w-7" />
      </div>
      <h3 className="font-semibold text-[#233b49]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#70828d]">{description}</p>
      {href && action && (
        <Link href={href} className="btn-primary mt-5 text-sm">
          {action}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c2ab3] p-4"
      role="presentation"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 inline-flex rounded-xl bg-[#fff3e9] p-3 text-[#b86d30]">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h2 id="confirm-title" className="text-xl font-bold text-[#173040]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#6d7c87]">{description}</p>
        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="button" className="btn-primary text-sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
