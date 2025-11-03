'use client';

import React, { useMemo, type ReactNode, useState, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase, getSdks } from '@/firebase';
import { type FirebaseApp } from 'firebase/app';
import { type Auth } from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);

  useEffect(() => {
    // Defer initialization until the component has mounted on the client.
    // This can help avoid race conditions and conflicts with browser extensions.
    if (typeof window !== 'undefined' && !firebaseServices) {
      setFirebaseServices(initializeFirebase());
    }
  }, []); // Empty dependency array ensures this runs only once on mount.

  if (!firebaseServices) {
    // You can return a loading spinner or null here while Firebase initializes.
    // Returning null is often fine if the parent layout has a loading UI.
    return null;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
