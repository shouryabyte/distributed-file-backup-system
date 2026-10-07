import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { currentUser, sessionCookie } from '@/lib/server/backend';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(sessionCookie)?.value;
  const user = await currentUser(token);
  if (!user) redirect('/login');
  return <AppShell user={user}>{children}</AppShell>;
}
