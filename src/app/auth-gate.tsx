
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If loading is finished and there's no user, redirect to login
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // While checking auth state, show a loading screen
  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
           <ShieldCheck className="h-12 w-12 text-primary animate-pulse" />
           <p className="text-muted-foreground">Initializing Application...</p>
        </div>
      </div>
    );
  }

  // If user is logged in, render the main application
  if (user) {
    return <>{children}</>;
  }

  // If no user and not loading, we've already initiated redirect,
  // so we can render null or a minimal loader while redirect happens.
  return null;
}
