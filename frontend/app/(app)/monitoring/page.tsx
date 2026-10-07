'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, HeartPulse, ScrollText } from 'lucide-react';
import { PageHeading, StatusBadge } from '@/components/ui';

export default function MonitoringPage() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (active) setHealthy(response.ok);
      } catch {
        if (active) setHealthy(false);
      }
    };
    void check();
    const timer = window.setInterval(check, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      <PageHeading
        eyebrow="Observability"
        title="Monitoring"
        description="Open the existing monitoring tools and check the API's live health status."
      />
      <section className="surface mb-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#e9f5f2] text-[#108069]">
            <HeartPulse className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-bold text-[#25404a]">Express API health</h2>
            <p className="mt-1 text-xs text-[#8da0a7]">
              Checked every 15 seconds through the existing /health endpoint
            </p>
          </div>
        </div>
        <StatusBadge
          label={healthy === null ? 'Checking' : healthy ? 'API online' : 'API offline'}
          tone={healthy === null ? 'neutral' : healthy ? 'good' : 'bad'}
        />
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="surface group p-7 transition-transform hover:-translate-y-0.5 hover:border-[#a7d0cc]"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-[#fff1e8] text-[#bc7335]">
              <BarChart3 className="h-7 w-7" />
            </span>
            <ArrowUpRight className="h-5 w-5 text-[#a0adb3] group-hover:text-[#087c80]" />
          </div>
          <h2 className="mt-8 text-xl font-bold text-[#28434d]">Grafana dashboard</h2>
          <p className="mt-2 text-sm leading-6 text-[#7d929b]">
            Explore API request rate, latency, deduplication ratio, replication results, worker
            retries, and storage-node health.
          </p>
          <span className="mt-6 inline-block text-xs font-bold uppercase tracking-wider text-[#087c80]">
            Open Grafana ↗
          </span>
        </a>
        <a
          href="http://localhost:9090"
          target="_blank"
          rel="noopener noreferrer"
          className="surface group p-7 transition-transform hover:-translate-y-0.5 hover:border-[#a7d0cc]"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-[#e8effb] text-[#5979b0]">
              <Activity className="h-7 w-7" />
            </span>
            <ArrowUpRight className="h-5 w-5 text-[#a0adb3] group-hover:text-[#087c80]" />
          </div>
          <h2 className="mt-8 text-xl font-bold text-[#28434d]">Prometheus metrics</h2>
          <p className="mt-2 text-sm leading-6 text-[#7d929b]">
            Inspect scrape targets and query the live measurements reported by the API and workers.
          </p>
          <span className="mt-6 inline-block text-xs font-bold uppercase tracking-wider text-[#087c80]">
            Open Prometheus ↗
          </span>
        </a>
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#dce9e9] bg-[#eef6f5] p-5 text-sm leading-6 text-[#62828a]">
        <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-[#087c80]" />
        <p>
          Grafana and Prometheus are existing services in this repository. This page links to them
          rather than duplicating their dashboards. Grafana uses the credentials in your local{' '}
          <code>.env</code>.
        </p>
      </div>
    </>
  );
}
