'use client';

import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase";
import * as React from "react";

export function AppProviders({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isClient, setIsClient] = React.useState(false);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    return (
        <FirebaseClientProvider>
            {children}
            {isClient && <Toaster />}
        </FirebaseClientProvider>
    )
}
