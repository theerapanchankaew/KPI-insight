
'use client';

import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase";
import { useEffect, useState } from "react";

export function AppProviders({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    return (
        <FirebaseClientProvider>
            {children}
            {isClient && <Toaster />}
        </FirebaseClientProvider>
    )
}
