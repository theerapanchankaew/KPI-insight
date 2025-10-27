
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If loading is finished and there's no user, redirect to login
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // If user is logged in, render the main application
  if (user) {
    return <>{children}</>;
  }

  // While loading or if there's no user (and redirect is in progress), render nothing.
  // The loading UI will be handled by the parent layout.
  return null;
}
