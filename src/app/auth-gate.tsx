
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

  // While loading, return null to avoid rendering anything. The parent layout will show the loading UI.
  if (isUserLoading) {
    return null;
  }
  
  // If user is logged in, render the main application
  if (user) {
    return <>{children}</>;
  }

  // If there's no user and we are about to redirect, render null.
  return null;
}
