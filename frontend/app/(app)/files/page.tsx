'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  Eye,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { filesApi } from '@/lib/api/files';
import { formatBytes, formatDate } from '@/lib/format';
import type { FileRecord } from '@/lib/types';
import {
  ConfirmDialog,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeading,
  StatusBadge,
  SuccessNotice,
} from '@/components/ui';

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState<FileRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setFiles(await filesApi.list());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load files.');
    }
  }, []);
  useEffect(() => {
    let active = true;
    filesApi
      .list()
      .then((items) => {
        if (active) setFiles(items);
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Could not load files.');
      });
    return () => {
      active = false;
    };
  }, []);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await filesApi.remove(deleting.id);
      setSuccess(
        `“${deleting.file_name}” was deleted. Unused chunks are cleaned up in the background.`,
      );
      setDeleting(null);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };
  const verify = async (file: FileRecord) => {
    setVerifyingId(file.id);
    setError('');
    setSuccess('');
    try {
      const result = await filesApi.verify(file.id);
      setSuccess(
        `Verification queued for ${result.queued} chunk${result.queued === 1 ? '' : 's'} in “${file.file_name}”. Results arrive asynchronously.`,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not queue verification.');
    } finally {
      setVerifyingId(null);
    }
  };
  const visible =
    files?.filter(
      (file) =>
        file.file_name.toLowerCase().includes(query.toLowerCase()) || file.id.includes(query),
    ) ?? [];

  return (
    <>
      <PageHeading
        eyebrow="Your library"
        title="Files"
        description="Browse, verify, download, and manage your backed-up files."
        action={
          <Link href="/upload" className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Upload file
          </Link>
        }
      />
      <div className="mb-5 space-y-3">
        {error && <ErrorNotice message={error} />}
        {success && <SuccessNotice message={success} />}
      </div>
      {!files ? (
        <LoadingBlock label="Loading files…" />
      ) : files.length === 0 ? (
        <EmptyState
          title="Your library is empty"
          description="Upload a file and it will appear here with its size, chunk count, and details."
          href="/upload"
          action="Upload your first file"
        />
      ) : (
        <section className="surface overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-[#e8eeee] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[#263f4d]">
                All files{' '}
                <span className="ml-1 text-sm font-medium text-[#8798a2]">({files.length})</span>
              </h2>
              <p className="mt-1 text-xs text-[#94a3ab]">
                Only files owned by your account are shown
              </p>
            </div>
            <label className="relative block sm:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#91a0a8]" />
              <input
                className="input py-2 pl-9 text-sm"
                placeholder="Search files or IDs"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search files"
              />
            </label>
          </div>
          {visible.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#81929b]">
              No files match your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead className="bg-[#f8fafa] text-xs font-semibold uppercase tracking-[.1em] text-[#91a1a8]">
                  <tr>
                    <th className="px-6 py-3">File</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Chunks</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f1]">
                  {visible.map((file) => (
                    <tr key={file.id} className="hover:bg-[#fbfdfd]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf5f5] text-[#087c80]">
                            <FileText className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <Link
                              href={`/files/${file.id}`}
                              className="block max-w-[220px] truncate text-sm font-semibold text-[#263e4b] hover:text-[#087c80]"
                            >
                              {file.file_name}
                            </Link>
                            <span
                              className="block max-w-[220px] truncate font-mono text-[10px] text-[#9aa8af]"
                              title={file.id}
                            >
                              {file.id}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#5e7480]">
                        {formatBytes(file.file_size)}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#5e7480]">{file.total_chunks}</td>
                      <td className="px-4 py-4">
                        <StatusBadge
                          label={file.status}
                          tone={file.status === 'READY' ? 'good' : 'warn'}
                        />
                      </td>
                      <td className="px-4 py-4 text-xs text-[#768a94]">
                        {formatDate(file.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/files/${file.id}`}
                            className="rounded-lg p-2 text-[#748995] hover:bg-[#eaf4f3] hover:text-[#087c80]"
                            aria-label={`View ${file.file_name}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <a
                            href={filesApi.downloadUrl(file.id)}
                            className="rounded-lg p-2 text-[#748995] hover:bg-[#eaf4f3] hover:text-[#087c80]"
                            aria-label={`Download ${file.file_name}`}
                            title="Download"
                          >
                            <ArrowDownToLine className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-[#748995] hover:bg-[#eaf4f3] hover:text-[#087c80]"
                            onClick={() => void verify(file)}
                            disabled={verifyingId === file.id}
                            aria-label={`Verify ${file.file_name}`}
                            title="Queue verification"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-[#748995] hover:bg-[#fff0ef] hover:text-[#b74f46]"
                            onClick={() => setDeleting(file)}
                            aria-label={`Delete ${file.file_name}`}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[#edf1f1] px-6 py-4 text-xs text-[#91a0a8]">
            <span>
              Showing {visible.length} of {files.length} files
            </span>
            <Link
              href="/upload"
              className="inline-flex items-center gap-1 font-semibold text-[#087c80]"
            >
              Add another <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this file?"
          description={`“${deleting.file_name}” will be removed from your account. Shared chunks stay available for other files; unused chunks are cleaned up later.`}
          confirmLabel="Delete file"
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
