'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  Boxes,
  CloudUpload,
  Database,
  Files,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import type { User } from '@/lib/types';
import { StatusBadge } from './ui';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/files', label: 'Files', icon: Files },
  { href: '/upload', label: 'Upload', icon: CloudUpload },
  { href: '/nodes', label: 'Storage nodes', icon: Database },
  { href: '/monitoring', label: 'Monitoring', icon: Activity },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

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

  useEffect(() => {
    const expired = () => {
      router.replace('/login');
      router.refresh();
    };
    window.addEventListener('vaultline:unauthorized', expired);
    return () => window.removeEventListener('vaultline:unauthorized', expired);
  }, [router]);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen lg:flex">
      <aside className="flex w-full flex-col bg-[#0d2230] text-[#cedde1] lg:fixed lg:inset-y-0 lg:w-[248px]">
        <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#16a6a6] text-white shadow-[0_6px_20px_#0a777778]">
            <Boxes className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-xl font-bold tracking-tight text-white">
              vaultline<span className="text-[#4de0c6]">.</span>
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[.16em] text-[#79a0a9]">
              Distributed backup
            </span>
          </span>
        </Link>
        <div className="hidden px-6 pt-7 text-[10px] font-bold uppercase tracking-[.2em] text-[#78949e] lg:block">
          Workspace
        </div>
        <nav
          aria-label="Main navigation"
          className="flex gap-1 overflow-x-auto px-3 pb-4 lg:mt-4 lg:flex-col lg:overflow-visible lg:px-3"
        >
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href === '/files' && pathname.startsWith('/files/'));
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:px-4 ${active ? 'bg-[#193b47] text-white' : 'text-[#9fb8be] hover:bg-[#163440] hover:text-white'}`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-[#51d3c3]' : ''}`} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden px-5 pb-6 lg:block">
          <div className="rounded-2xl border border-[#33515b] bg-[#173541] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-[#57d6bd]" /> Resilience by design
            </div>
            <p className="mt-2 text-xs leading-5 text-[#a0bbc0]">
              Chunk deduplication and asynchronous replicas across four storage nodes.
            </p>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-4 border-b border-[#e2e9ea] bg-[#ffffffed] px-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="hidden text-xs font-semibold uppercase tracking-[.18em] text-[#81909a] sm:block">
            System overview <span className="mx-2 text-[#c9d4d8]">/</span>{' '}
            <span className="text-[#29505c]">
              {navigation.find((item) => pathname.startsWith(item.href))?.label ?? 'Files'}
            </span>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
            <StatusBadge
              label={healthy === null ? 'Checking API' : healthy ? 'API online' : 'API offline'}
              tone={healthy === null ? 'neutral' : healthy ? 'good' : 'bad'}
            />
            <div className="hidden h-8 w-px bg-[#e1e8e9] sm:block" />
            <div className="hidden max-w-40 truncate text-right sm:block">
              <div className="truncate text-sm font-semibold text-[#28424d]">{user.email}</div>
              <div className="text-xs text-[#84949c]">Signed in</div>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="rounded-lg p-2 text-[#6b8089] hover:bg-[#eaf2f2] hover:text-[#155d63]"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          {children}
        </main>
        <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 pb-7 text-xs text-[#95a5ad] sm:px-8 lg:px-10">
          <span>Vaultline · Local distributed systems lab</span>
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#087c80]"
          >
            Open Grafana <ArrowUpRight className="h-3 w-3" />
          </a>
        </footer>
      </div>
    </div>
  );
}
