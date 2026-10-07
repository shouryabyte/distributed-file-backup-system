'use client';

import { DragEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  FileText,
  RotateCcw,
  UploadCloud,
  X,
} from 'lucide-react';
import { formatBytes } from '@/lib/format';
import { resumableApi, uploadDirect } from '@/lib/api/uploads';
import { ErrorNotice, PageHeading, SuccessNotice } from '@/components/ui';

interface Config {
  maxFileSizeBytes: number;
  chunkSizeBytes: number;
}
interface SavedSession {
  id: string;
  name: string;
  size: number;
  modified: number;
}
const savedKey = 'vaultline-upload-session';

export default function UploadPage() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<'direct' | 'resumable'>('direct');
  const [config, setConfig] = useState<Config>({
    maxFileSizeBytes: 1073741824,
    chunkSizeBytes: 5242880,
  });
  const [saved, setSaved] = useState<SavedSession | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const value = localStorage.getItem(savedKey);
      return value ? (JSON.parse(value) as SavedSession) : null;
    } catch {
      return null;
    }
  });
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'processing' | 'complete'>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then(setConfig)
      .catch(() => undefined);
  }, []);

  const select = (selected?: File) => {
    if (!selected) return;
    setFile(selected);
    setFileId(null);
    setError('');
    setProgress(0);
    setPhase('idle');
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    select(event.dataTransfer.files[0]);
  };
  const matchesSaved = Boolean(
    file &&
    saved &&
    file.name === saved.name &&
    file.size === saved.size &&
    file.lastModified === saved.modified,
  );

  const start = async () => {
    if (!file) return;
    if (file.size > config.maxFileSizeBytes) {
      setError(`This file exceeds the ${formatBytes(config.maxFileSizeBytes)} limit.`);
      return;
    }
    if (mode === 'direct' && /[^\x20-\x7E]/.test(file.name)) {
      setError('Use resumable upload for a file name with non-ASCII characters.');
      return;
    }
    setError('');
    setProgress(0);
    setPhase('sending');
    try {
      if (mode === 'direct') {
        const result = await uploadDirect(file, (percent) => {
          setProgress(percent);
          if (percent >= 100) setPhase('processing');
        });
        setFileId(result.fileId);
      } else {
        let id: string;
        if (matchesSaved && saved) id = saved.id;
        else {
          const session = await resumableApi.initiate(file);
          id = session.id;
          const record = { id, name: file.name, size: file.size, modified: file.lastModified };
          localStorage.setItem(savedKey, JSON.stringify(record));
          setSaved(record);
        }
        setSessionId(id);
        const status = await resumableApi.status(id);
        const total = Math.ceil(file.size / config.chunkSizeBytes);
        setProgress(total ? Math.round((status.uploadedChunks.length / total) * 100) : 100);
        for (const sequence of status.missingChunks) {
          const begin = (sequence - 1) * config.chunkSizeBytes;
          await resumableApi.chunk(id, sequence, file.slice(begin, begin + config.chunkSizeBytes));
          setProgress((previous) => Math.min(100, previous + Math.round(100 / Math.max(total, 1))));
        }
        setPhase('processing');
        const result = await resumableApi.complete(id);
        setFileId(result.fileId);
        localStorage.removeItem(savedKey);
        setSaved(null);
      }
      setProgress(100);
      setPhase('complete');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Upload failed.');
      setPhase('idle');
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="Add to your library"
        title="Upload a file"
        description="The API splits your file into content-addressed chunks, writes the first copy, and schedules replicas in the background."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.8fr)]">
        <section className="surface p-6 sm:p-8">
          <div className="mb-7 flex gap-2 border-b border-[#e8eeee] pb-5">
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'direct' ? 'bg-[#e5f4f2] text-[#087c80]' : 'text-[#82939c] hover:bg-[#f3f7f7]'}`}
            >
              Direct upload
            </button>
            <button
              type="button"
              onClick={() => setMode('resumable')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'resumable' ? 'bg-[#e5f4f2] text-[#087c80]' : 'text-[#82939c] hover:bg-[#f3f7f7]'}`}
            >
              Resumable upload
            </button>
          </div>
          <input
            ref={input}
            type="file"
            className="hidden"
            onChange={(event) => select(event.target.files?.[0])}
            aria-label="Choose a file"
          />
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') input.current?.click();
            }}
            onClick={() => input.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-[#087c80] bg-[#eaf8f5]' : 'border-[#cddfe0] bg-[#f9fcfb] hover:border-[#70adaf] hover:bg-[#f3faf8]'}`}
          >
            <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#e2f2ef] text-[#087c80]">
              <CloudUpload className="h-8 w-8" />
            </span>
            <h2 className="text-lg font-bold text-[#2a434e]">Drop your file here</h2>
            <p className="mt-2 text-sm text-[#81939d]">or click to browse your device</p>
            <p className="mt-5 text-xs text-[#a0acb1]">
              Maximum file size: {formatBytes(config.maxFileSizeBytes)}
            </p>
          </div>
          {file && (
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-[#dce8e8] bg-white p-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f4f3] text-[#087c80]">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#29434d]">{file.name}</p>
                <p className="mt-1 text-xs text-[#91a0a9]">
                  {formatBytes(file.size)} · {Math.ceil(file.size / config.chunkSizeBytes)} chunk
                  {Math.ceil(file.size / config.chunkSizeBytes) === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPhase('idle');
                }}
                disabled={phase === 'sending' || phase === 'processing'}
                className="p-1 text-[#9aa8ae] hover:text-[#b35750]"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {mode === 'resumable' && (
            <p className="mt-4 rounded-xl bg-[#eef6f5] p-4 text-xs leading-5 text-[#577a80]">
              If the transfer stops, select the same file again and the app will ask the API which
              chunks are missing. Only the upload session ID is saved in this browser.
            </p>
          )}
          {matchesSaved && mode === 'resumable' && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#087c80]">
              <RotateCcw className="h-4 w-4" /> Matching session found. Missing chunks will be
              resumed.
            </div>
          )}
          {saved && mode === 'resumable' && (
            <button
              type="button"
              className="mt-3 text-xs font-semibold text-[#a6743f] hover:underline"
              onClick={() => {
                localStorage.removeItem(savedKey);
                setSaved(null);
                setSessionId(null);
              }}
            >
              Start a new upload session
            </button>
          )}
          {sessionId && mode === 'resumable' && (
            <p className="mt-3 break-all font-mono text-[11px] text-[#83969c]">
              Session: {sessionId}
            </p>
          )}
          {phase !== 'idle' && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-semibold text-[#42606c]">
                  {phase === 'complete'
                    ? 'Upload complete'
                    : phase === 'processing'
                      ? 'Processing chunks…'
                      : 'Sending bytes…'}
                </span>
                <span className="font-bold text-[#087c80]">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e6efef]">
                <div
                  className="h-full rounded-full bg-[#12a59d] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {error && (
            <div className="mt-5">
              <ErrorNotice message={error} />
            </div>
          )}
          {fileId && (
            <div className="mt-5">
              <SuccessNotice message="Your file is ready. Additional replicas may still be created in the background." />
              <Link
                href={`/files/${fileId}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#087c80] hover:underline"
              >
                View file details <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
          <button
            type="button"
            className="btn-primary mt-7 w-full py-3 text-sm"
            onClick={() => void start()}
            disabled={!file || phase === 'sending' || phase === 'processing'}
          >
            <UploadCloud className="h-4 w-4" />
            {phase === 'sending' || phase === 'processing'
              ? 'Uploading…'
              : mode === 'resumable' && matchesSaved
                ? 'Resume upload'
                : 'Start upload'}
          </button>
        </section>
        <aside className="space-y-5">
          <div className="surface p-6">
            <h2 className="text-lg font-bold text-[#2a444f]">What happens next?</h2>
            <div className="mt-6 space-y-6">
              {[
                [
                  '01',
                  'Chunk and identify',
                  'The API divides the file into fixed-size pieces and hashes each one.',
                ],
                [
                  '02',
                  'Reuse identical content',
                  'Existing chunks can be shared across files without rewriting bytes.',
                ],
                [
                  '03',
                  'Build replicas',
                  'A Kafka worker copies each new chunk to other healthy storage nodes.',
                ],
              ].map(([step, title, detail]) => (
                <div key={step} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e4f3f0] text-xs font-bold text-[#087c80]">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#35515b]">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#8599a0]">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#cfe6e2] bg-[#e9f5f3] p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1b666a]">
              <CheckCircle2 className="h-4 w-4" /> Synchronous promise
            </div>
            <p className="mt-2 text-xs leading-5 text-[#64898b]">
              An upload response confirms the primary write and metadata. The remaining replicas are
              created asynchronously.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
