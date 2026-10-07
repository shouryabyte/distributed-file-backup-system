'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, PauseCircle, PlayCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { nodesApi } from '@/lib/api/nodes';
import type { StorageNode } from '@/lib/types';
import {
  ConfirmDialog,
  ErrorNotice,
  LoadingBlock,
  PageHeading,
  StatusBadge,
  SuccessNotice,
} from '@/components/ui';

export default function NodesPage() {
  const [nodes, setNodes] = useState<StorageNode[] | null>(null);
  const [factor, setFactor] = useState(3);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [disable, setDisable] = useState<StorageNode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setNodes(await nodesApi.list());
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load storage nodes.');
    }
  }, []);
  useEffect(() => {
    let active = true;
    nodesApi
      .list()
      .then((items) => {
        if (active) setNodes(items);
      })
      .catch((failure) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'Could not load storage nodes.');
      });
    fetch('/api/config')
      .then((response) => response.json())
      .then((config) => setFactor(config.replicationFactor))
      .catch(() => undefined);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const update = async (node: StorageNode, enabled: boolean) => {
    setBusyId(node.id);
    setError('');
    setSuccess('');
    try {
      await nodesApi.setEnabled(node.id, enabled);
      setSuccess(
        `${node.id} ${enabled ? 'enabled' : 'disabled'}. The backend will scan for chunks that need another healthy replica.`,
      );
      setDisable(null);
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not change node state.');
    } finally {
      setBusyId(null);
    }
  };
  const healthy = nodes?.filter((node) => node.enabled && node.healthy).length ?? 0;

  return (
    <>
      <PageHeading
        eyebrow="Infrastructure"
        title="Storage nodes"
        description="Observe live node health and demonstrate how the backend responds when a node is disabled."
        action={
          <button type="button" className="btn-secondary text-sm" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" /> Refresh nodes
          </button>
        }
      />
      <div className="mb-6 space-y-3">
        {error && <ErrorNotice message={error} />}
        {success && <SuccessNotice message={success} />}
      </div>
      {!nodes ? (
        <LoadingBlock label="Checking storage nodes…" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="surface p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8c9da6]">
                Available nodes
              </p>
              <p className="mt-2 text-3xl font-bold text-[#1d3b46]">
                {healthy}{' '}
                <span className="text-lg font-medium text-[#9aadb2]">/ {nodes.length}</span>
              </p>
              <p className="mt-1 text-xs text-[#8b9ea6]">Enabled and healthy</p>
            </div>
            <div className="surface p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8c9da6]">
                Desired replicas
              </p>
              <p className="mt-2 text-3xl font-bold text-[#1d3b46]">{factor}</p>
              <p className="mt-1 text-xs text-[#8b9ea6]">Healthy copies per chunk</p>
            </div>
            <div className="surface p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8c9da6]">
                Spare capacity
              </p>
              <p className="mt-2 text-3xl font-bold text-[#1d3b46]">
                {Math.max(0, healthy - factor)}
              </p>
              <p className="mt-1 text-xs text-[#8b9ea6]">Healthy nodes beyond the target</p>
            </div>
          </div>
          <div className="mb-6 flex gap-3 rounded-xl border border-[#f0dfbd] bg-[#fff9ef] p-4 text-sm text-[#8f6c34]">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <strong className="font-bold">Demo administration</strong>
              <p className="mt-1 leading-6">
                Disabling a node excludes it from reads and new placement. The backend schedules
                replacement replicas on healthy nodes. Physical data on the disabled node is
                retained.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {nodes.map((node) => (
              <article key={node.id} className="surface p-5">
                <div className="flex items-start justify-between">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-xl ${node.enabled && node.healthy ? 'bg-[#e6f6ef] text-[#168265]' : 'bg-[#fff0e5] text-[#b97434]'}`}
                  >
                    <Database className="h-6 w-6" />
                  </span>
                  <StatusBadge
                    label={!node.enabled ? 'Disabled' : node.healthy ? 'Healthy' : 'Unhealthy'}
                    tone={!node.enabled ? 'warn' : node.healthy ? 'good' : 'bad'}
                  />
                </div>
                <h2 className="mt-6 text-xl font-bold text-[#28434d]">{node.id}</h2>
                <p className="mt-1 text-xs text-[#95a5ac]">Storage node</p>
                <div className="mt-5 space-y-3 border-t border-[#edf1f2] pt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#98a8ae]">Enabled</span>
                    <span className="font-semibold text-[#435d66]">
                      {node.enabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#98a8ae]">Health check</span>
                    <span className="font-semibold text-[#435d66]">
                      {node.healthy ? 'Passing' : 'Unavailable'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#98a8ae]">Internal address</span>
                    <p className="mt-1 break-all font-mono text-[11px] text-[#536f77]">
                      {node.url}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === node.id}
                  onClick={() => {
                    if (node.enabled) setDisable(node);
                    else void update(node, true);
                  }}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${node.enabled ? 'border-[#ead8c5] text-[#a6743f] hover:bg-[#fff7f0]' : 'border-[#cce4dc] text-[#178365] hover:bg-[#f0faf6]'}`}
                >
                  {node.enabled ? (
                    <>
                      <PauseCircle className="h-4 w-4" /> Disable node
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" /> Enable node
                    </>
                  )}
                </button>
              </article>
            ))}
          </div>
          <div className="surface mt-6 p-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#087c80]" />
              <h2 className="font-bold text-[#29434d]">Watch a failover</h2>
            </div>
            <div className="mt-5 grid gap-4 text-sm text-[#64808a] sm:grid-cols-4">
              {[
                ['01', 'Open a file detail', 'See which nodes hold each chunk.'],
                ['02', 'Disable one node', 'Its replicas stop counting as healthy.'],
                ['03', 'Wait for repair', 'The worker copies data to available capacity.'],
                ['04', 'Refresh the detail', 'The replacement node appears after repair.'],
              ].map(([step, title, description]) => (
                <div key={step}>
                  <span className="text-xs font-bold text-[#0e8285]">{step}</span>
                  <h3 className="mt-2 font-semibold text-[#38525c]">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#879aa2]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {disable && (
        <ConfirmDialog
          title={`Disable ${disable.id}?`}
          description="This demo action removes the node from reads and new placement. The backend will schedule repair using other healthy nodes. Re-enable it when the demonstration is complete."
          confirmLabel="Disable node"
          busy={busyId === disable.id}
          onConfirm={() => void update(disable, false)}
          onCancel={() => setDisable(null)}
        />
      )}
    </>
  );
}
