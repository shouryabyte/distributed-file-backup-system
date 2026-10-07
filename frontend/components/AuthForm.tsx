'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Boxes, Check, Database, LockKeyhole, ShieldCheck } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { ErrorNotice } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const registering = mode === 'register';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (registering) await authApi.register(email, password);
      else await authApi.login(email, password);
      router.replace('/dashboard');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(440px,560px)]">
      <div className="relative hidden overflow-hidden bg-[#0b2430] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-28 h-96 w-96 rounded-full border border-[#3a626b66]" />
        <div className="absolute -right-10 top-10 h-72 w-72 rounded-full border border-[#3a626b66]" />
        <div className="absolute bottom-[-150px] left-[-100px] h-96 w-96 rounded-full bg-[#0f747759] blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#16a6a6]">
            <Boxes className="h-6 w-6" />
          </span>
          <span className="text-2xl font-bold tracking-tight">
            vaultline<span className="text-[#4de0c6]">.</span>
          </span>
        </div>
        <div className="relative max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#47626c] bg-[#1a3b48] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#9ee7dc]">
            <ShieldCheck className="h-4 w-4" /> BUILT FOR RESILIENCE
          </div>
          <h1 className="text-5xl font-bold leading-[1.12] tracking-tight xl:text-6xl">
            Your files.
            <br />
            Safely distributed.
            <br />
            <span className="text-[#55d8c3]">Clearly visible.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-[#b5cbd0]">
            Explore how chunk deduplication, healthy replicas, and recovery work together in one
            practical backup system.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-3">
            {[
              ['01', 'Split into chunks'],
              ['02', 'Replicate safely'],
              ['03', 'Recover quickly'],
            ].map(([number, title]) => (
              <div key={number} className="rounded-xl border border-[#365560] bg-[#173846] p-4">
                <span className="text-xs font-bold text-[#54d7c4]">{number}</span>
                <p className="mt-3 text-sm font-semibold text-[#edf8f7]">{title}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-sm text-[#7faab1]">
          <Database className="h-4 w-4" /> PostgreSQL · Kafka · Redis · four storage nodes
        </div>
      </div>
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8f8] px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#087c80] text-white">
              <Boxes className="h-6 w-6" />
            </span>
            <span className="text-2xl font-bold">
              vaultline<span className="text-[#087c80]">.</span>
            </span>
          </div>
          <span className="mb-5 inline-flex rounded-xl bg-[#e2f2ef] p-3 text-[#087c80]">
            <LockKeyhole className="h-6 w-6" />
          </span>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#087c80]">
            {registering ? 'Create an account' : 'Welcome back'}
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-[#19313e]">
            {registering ? 'Start with Vaultline' : 'Sign in to Vaultline'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#758690]">
            {registering
              ? 'Create a local demo account to store and explore your files.'
              : 'Access your files and see the distributed system at work.'}
          </p>
          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#354c58]">Email address</span>
              <input
                type="email"
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#354c58]">Password</span>
              <input
                type="password"
                autoComplete={registering ? 'new-password' : 'current-password'}
                className="input"
                placeholder={registering ? 'At least 8 characters' : 'Enter your password'}
                minLength={registering ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <ErrorNotice message={error} />}
            <button type="submit" className="btn-primary w-full py-3.5" disabled={busy}>
              {busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-[#74858d]">
            {registering ? 'Already have an account?' : 'New to Vaultline?'}{' '}
            <Link
              className="font-semibold text-[#087c80] hover:underline"
              href={registering ? '/login' : '/register'}
            >
              {registering ? 'Sign in' : 'Create account'}
            </Link>
          </p>
          <div className="mt-12 flex items-center justify-center gap-2 border-t border-[#dfe8e9] pt-6 text-xs text-[#91a0a6]">
            <Check className="h-4 w-4 text-[#087c80]" /> Authentication handled by the existing
            backup API
          </div>
        </div>
      </div>
    </div>
  );
}
