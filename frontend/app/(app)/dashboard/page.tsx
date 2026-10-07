'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Database,
  FileStack,
  Files,
  HardDrive,
  Layers3,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { filesApi } from '@/lib/api/files';
import { nodesApi } from '@/lib/api/nodes';
import { formatBytes, formatDate } from '@/lib/format';
import type { FileRecord, StorageNode } from '@/lib/types';
import { EmptyState, ErrorNotice, LoadingBlock, PageHeading, StatusBadge } from '@/components/ui';

export default function DashboardPage() {
  const [files, setFiles] = useState<FileRecord[] | null>(null);
  const [nodes, setNodes] = useState<StorageNode[] | null>(null);
  const [factor, setFactor] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([filesApi.list(), nodesApi.list(), fetch('/api/config').then((r) => r.json())])
      .then(([fileList, nodeList, config]) => {
        if (!active) return;
        setFiles(fileList);
        setNodes(nodeList);
        setFactor(config.replicationFactor);
      })
      .catch((failure) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'Could not load dashboard.');
      });
    return () => {
      active = false;
    };
  }, []);

  const healthyNodes = nodes?.filter((node) => node.enabled && node.healthy).length ?? 0;
  const logicalBytes = files?.reduce((sum, file) => sum + Number(file.file_size), 0) ?? 0;
  const fileChunks = files?.reduce((sum, file) => sum + file.total_chunks, 0) ?? 0;

  return (
    <>
      <PageHeading
        eyebrow="Overview"
        title="Your backup workspace"
        description="A clear view of your files and the storage nodes keeping their chunks available."
        action={
          <Link href="/upload" className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Upload a file
          </Link>
        }
      />
      {error && (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      )}
      {!files || !nodes ? (
        <LoadingBlock label="Loading your workspace…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Your files',
                value: files.length.toString(),
                detail: 'Files in your account',
                icon: Files,
                tone: 'bg-[#e7f5f3] text-[#0b777a]',
              },
              {
                label: 'Logical data',
                value: formatBytes(logicalBytes),
                detail: 'Before deduplication',
                icon: HardDrive,
                tone: 'bg-[#eaf1fc] text-[#4a74a7]',
              },
              {
                label: 'File chunks',
                value: fileChunks.toString(),
                detail: 'Positions across your files',
                icon: Layers3,
                tone: 'bg-[#f5effc] text-[#8265a7]',
              },
              {
                label: 'Healthy nodes',
                value: `${healthyNodes} / ${nodes.length}`,
                detail: `Desired copies per chunk: ${factor ?? '—'}`,
                icon: ShieldCheck,
                tone: 'bg-[#fff3e7] text-[#a76e2d]',
              },
            ].map(({ label, value, detail, icon: Icon, tone }) => (
              <div key={label} className="surface p-5">
                <div className={`mb-5 inline-flex rounded-xl p-3 ${tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-[#788994]">{label}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-[#1a3341]">{value}</p>
                <p className="mt-2 text-xs text-[#95a3ab]">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
            <section className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#e6edee] px-6 py-5">
                <div>
                  <h2 className="text-lg font-bold text-[#1c3543]">Recent files</h2>
                  <p className="mt-1 text-xs text-[#8b9aa3]">Your latest uploads</p>
                </div>
                <Link
                  href="/files"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#087c80] hover:underline"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {files.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No files yet"
                    description="Upload your first file to see it here and inspect how it is stored."
                    href="/upload"
                    action="Upload a file"
                  />
                </div>
              ) : (
                <div className="divide-y divide-[#edf1f2]">
                  {files.slice(0, 5).map((file) => (
                    <Link
                      key={file.id}
                      href={`/files/${file.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-[#f8fbfa]"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ebf3f3] text-[#0b8183]">
                        <FileStack className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#29414e]">
                          {file.file_name}
                        </span>
                        <span className="mt-1 block text-xs text-[#94a2aa]">
                          {formatDate(file.created_at)}
                        </span>
                      </span>
                      <span className="hidden text-xs font-medium text-[#788b94] sm:block">
                        {formatBytes(file.file_size)}
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#a2b0b5]" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section className="surface p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1c3543]">Storage network</h2>
                  <p className="mt-1 text-xs text-[#8b9aa3]">Live node availability</p>
                </div>
                <Database className="h-5 w-5 text-[#87a5a6]" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className="rounded-xl border border-[#e4ebed] bg-[#f9fbfb] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold uppercase text-[#48616d]">
                        {node.id}
                      </span>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${node.enabled && node.healthy ? 'bg-[#29b18b]' : 'bg-[#d68d55]'}`}
                      />
                    </div>
                    <StatusBadge
                      label={!node.enabled ? 'Disabled' : node.healthy ? 'Healthy' : 'Unhealthy'}
                      tone={!node.enabled ? 'warn' : node.healthy ? 'good' : 'bad'}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-[#e9f5f3] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#28545a]">Replication factor</p>
                  <p className="text-xs text-[#63888a]">Desired healthy copies per chunk</p>
                </div>
                <span className="text-3xl font-bold text-[#087c80]">{factor ?? '—'}</span>
              </div>
              <Link
                href="/nodes"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#087c80] hover:underline"
              >
                Inspect storage nodes <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              [
                '01',
                'Chunk the file',
                'Bytes are split into fixed-size pieces and identified by SHA-256.',
              ],
              [
                '02',
                'Write a primary',
                'The API stores the first copy and records metadata in PostgreSQL.',
              ],
              [
                '03',
                'Replicate in background',
                'Kafka workers create the remaining copies on healthy nodes.',
              ],
            ].map(([step, title, description]) => (
              <div key={step} className="rounded-2xl border border-[#dce8e9] bg-[#eef6f5] p-5">
                <span className="text-xs font-bold tracking-widest text-[#158389]">
                  {step} / HOW IT WORKS
                </span>
                <h3 className="mt-3 font-bold text-[#29434d]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6d858a]">{description}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
