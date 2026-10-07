'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowLeft,
  Boxes,
  Copy,
  FileText,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { filesApi } from '@/lib/api/files';
import { nodesApi } from '@/lib/api/nodes';
import { formatBytes, formatDate, shortHash } from '@/lib/format';
import type { FileChunk, FileRecord, InspectedChunk } from '@/lib/types';
import {
  ConfirmDialog,
  ErrorNotice,
  LoadingBlock,
  PageHeading,
  StatusBadge,
  SuccessNotice,
} from '@/components/ui';

export default function FileDetailsPage() {
  const id = useParams<{ id: string }>().id;
  const router = useRouter();
  const [file, setFile] = useState<FileRecord | null>(null);
  const [chunks, setChunks] = useState<FileChunk[] | null>(null);
  const [inspected, setInspected] = useState<Record<string, InspectedChunk>>({});
  const [openHash, setOpenHash] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replicationFactor, setReplicationFactor] = useState(3);

  const refresh = useCallback(async () => {
    try {
      const [details, ordered] = await Promise.all([filesApi.detail(id), filesApi.chunks(id)]);
      setFile(details);
      setChunks(ordered);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load file.');
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    fetch('/api/config')
      .then((response) => response.json())
      .then((config) => {
        if (active) setReplicationFactor(config.replicationFactor);
      })
      .catch(() => undefined);
    Promise.all([filesApi.detail(id), filesApi.chunks(id)])
      .then(([details, ordered]) => {
        if (active) {
          setFile(details);
          setChunks(ordered);
        }
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Could not load file.');
      });
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id, refresh]);

  const inspect = async (hash: string) => {
    if (openHash === hash) {
      setOpenHash(null);
      return;
    }
    setOpenHash(hash);
    try {
      const info = inspected[hash] ?? (await nodesApi.chunk(id, hash));
      setInspected((previous) => ({ ...previous, [hash]: info }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not inspect chunk.');
    }
  };
  const verify = async () => {
    setBusy(true);
    setSuccess('');
    setError('');
    try {
      const result = await filesApi.verify(id);
      setSuccess(
        `Verification queued for ${result.queued} chunk${result.queued === 1 ? '' : 's'}. This runs in the background.`,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not queue verification.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await filesApi.remove(id);
      router.replace('/files');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Delete failed.');
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link
        href="/files"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#749099] hover:text-[#087c80]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to files
      </Link>
      <PageHeading
        eyebrow="File details"
        title={file?.file_name ?? 'Loading file…'}
        description="See the ordered chunks and live replica locations behind this file."
        action={
          <button type="button" className="btn-secondary text-sm" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />
      <div className="mb-5 space-y-3">
        {error && <ErrorNotice message={error} />}
        {success && <SuccessNotice message={success} />}
      </div>
      {!file || !chunks ? (
        <LoadingBlock label="Loading file and replicas…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'File size', value: formatBytes(file.file_size), icon: HardDrive },
              { label: 'Ordered chunks', value: file.total_chunks.toString(), icon: Boxes },
              { label: 'Status', value: file.status, icon: ShieldCheck },
              { label: 'Uploaded', value: formatDate(file.created_at), icon: FileText },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="surface p-5">
                <Icon className="mb-4 h-5 w-5 text-[#0c8588]" />
                <p className="text-xs font-semibold uppercase tracking-wider text-[#91a1aa]">
                  {label}
                </p>
                <p className="mt-2 text-lg font-bold text-[#253e4b]">{value}</p>
              </div>
            ))}
          </div>
          <section className="surface mt-6 p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-bold text-[#1b3441]">File metadata</h2>
                <p className="mt-1 text-sm text-[#8798a1]">
                  Stored in PostgreSQL; the bytes live on storage nodes.
                </p>
              </div>
              <StatusBadge label={file.status} tone={file.status === 'READY' ? 'good' : 'warn'} />
            </div>
            <dl className="mt-6 grid gap-5 border-t border-[#e8eeee] pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#96a4aa]">
                  File ID
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-[#34505b]">{file.id}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#96a4aa]">
                  Owner ID
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-[#34505b]">{file.user_id}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href={filesApi.downloadUrl(id)} className="btn-primary text-sm">
                <ArrowDownToLine className="h-4 w-4" /> Download file
              </a>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => void verify()}
                disabled={busy}
              >
                <ShieldCheck className="h-4 w-4" /> Queue verification
              </button>
              <button
                type="button"
                className="btn-secondary text-sm hover:!border-[#e8b8b3] hover:!text-[#b64d45]"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </section>
          <section className="mt-8">
            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-xl font-bold text-[#1b3441]">Chunk map</h2>
                <p className="mt-1 text-sm text-[#7c8f98]">
                  Chunks are read in this order to reconstruct the file. Replica positions update
                  every 5 seconds.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#91a1a9]">
                {chunks.length} ordered chunks
              </span>
            </div>
            {chunks.length === 0 ? (
              <div className="surface p-8 text-sm text-[#81939b]">
                This is an empty file, so it has no chunks or replicas.
              </div>
            ) : (
              <div className="space-y-4">
                {chunks.map((chunk) => {
                  const good = chunk.replicas.filter(
                    (replica) => replica.status === 'ACTIVE' && replica.enabled && replica.healthy,
                  ).length;
                  const info = inspected[chunk.hash];
                  return (
                    <div key={chunk.sequenceNumber} className="surface overflow-hidden">
                      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e7f4f2] font-mono text-sm font-bold text-[#087c80]">
                            {String(chunk.sequenceNumber).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-[#25404c]">
                                Chunk {chunk.sequenceNumber}
                              </h3>
                              <StatusBadge
                                label={`${good} healthy ${good === 1 ? 'copy' : 'copies'}`}
                                tone={
                                  good >= replicationFactor ? 'good' : good > 0 ? 'warn' : 'bad'
                                }
                              />
                            </div>
                            <p className="mt-2 text-xs text-[#84969f]">
                              {formatBytes(chunk.size)}{' '}
                              <span className="mx-2 text-[#c0cbce]">·</span> SHA-256{' '}
                              <span className="font-mono text-[#516b75]" title={chunk.hash}>
                                {shortHash(chunk.hash)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            className="btn-secondary px-3 py-2 text-xs"
                            onClick={() => void navigator.clipboard.writeText(chunk.hash)}
                            title="Copy full SHA-256"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy hash
                          </button>
                          <button
                            type="button"
                            className="btn-secondary px-3 py-2 text-xs"
                            onClick={() => void inspect(chunk.hash)}
                          >
                            {openHash === chunk.hash ? 'Hide details' : 'Inspect chunk'}
                          </button>
                        </div>
                      </div>
                      <div className="border-t border-[#edf1f2] bg-[#fafcfc] px-5 py-4">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#99aab0]">
                          Recorded replicas
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {chunk.replicas.length === 0 ? (
                            <span className="text-xs text-[#b35650]">No replicas recorded</span>
                          ) : (
                            chunk.replicas.map((replica) => (
                              <div
                                key={replica.nodeId}
                                className="flex items-center gap-2 rounded-lg border border-[#dfe9ea] bg-white px-3 py-2"
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${replica.status === 'ACTIVE' && replica.enabled && replica.healthy ? 'bg-[#28b68f]' : replica.status === 'CREATING' ? 'bg-[#d6a24c]' : 'bg-[#df7770]'}`}
                                />
                                <span className="font-mono text-xs font-semibold text-[#526c76]">
                                  {replica.nodeId}
                                </span>
                                <span className="text-[10px] text-[#9ba9ad]">
                                  {!replica.enabled
                                    ? 'disabled'
                                    : !replica.healthy
                                      ? 'unhealthy'
                                      : replica.status.toLowerCase()}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      {openHash === chunk.hash && (
                        <div className="border-t border-[#edf1f2] px-5 py-4 text-sm">
                          <p className="break-all font-mono text-xs text-[#5a717b]">{chunk.hash}</p>
                          {info ? (
                            <div className="mt-3 flex flex-wrap gap-5 text-[#55707b]">
                              <span>
                                References:{' '}
                                <strong className="text-[#1d4d56]">{info.reference_count}</strong>
                              </span>
                              <span>
                                Unique chunk size:{' '}
                                <strong className="text-[#1d4d56]">{formatBytes(info.size)}</strong>
                              </span>
                              <span>
                                Replica rows:{' '}
                                <strong className="text-[#1d4d56]">{info.replicas.length}</strong>
                              </span>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-[#8da0a7]">
                              Loading secure chunk inspection…
                            </p>
                          )}
                          <p className="mt-3 text-xs text-[#90a0a6]">
                            Reference count is the number of file positions using this content, not
                            the number of replicas.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
      {confirmDelete && file && (
        <ConfirmDialog
          title="Delete this file?"
          description={`“${file.file_name}” will disappear from your account. Background cleanup removes chunks only when no file still uses them.`}
          confirmLabel="Delete file"
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
