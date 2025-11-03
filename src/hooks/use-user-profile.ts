
'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/context/KpiDataContext';

/**
 * A centralized hook to fetch the current user's application-specific profile 
 * from the 'users' collection in Firestore.
 *
 * @returns An object containing:
 *  - `userProfile`: The user's profile data (or null if not found/loading).
 *  - `isLoading`: A boolean indicating if the profile data is being loaded.
 *  - `error`: Any error that occurred during fetching.
 */
export function useUserProfile() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  // Memoize the document reference to prevent re-creating it on every render.
  // The query depends on the user's UID, so it only changes when the user logs in or out.
  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  // Use the useDoc hook to get real-time updates for the user's profile document.
  const { data: userProfile, isLoading: isProfileDocLoading, error } = useDoc<AppUser>(userProfileRef);

  // The overall loading state is true if either the initial auth check is running
  // or the Firestore document is being fetched.
  const isLoading = isAuthLoading || isProfileDocLoading;

  return { userProfile, isLoading, error };
}

    