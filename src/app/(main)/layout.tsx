
"use client";

import React, { useState, createContext, useContext, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Bell,
  Menu,
  Search,
  ShieldCheck,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { appConfig, navItems, headerData } from '@/lib/data/layout-data';
import { KpiDataProvider, useKpiData } from '@/context/KpiDataContext';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthGate } from '@/app/auth-gate';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface AppLayoutContextType {
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

const AppLayoutContext = createContext<AppLayoutContextType | undefined>(undefined);

export function useAppLayout() {
  const context = useContext(AppLayoutContext);
  if (!context) {
    throw new Error('useAppLayout must be used within an AppLayoutProvider');
  }
  return context;
}

const AppSidebar = () => {
  const pathname = usePathname();
  const { settings } = useKpiData();

  return (
    <nav className="w-72 bg-card border-r border-border flex-col hidden lg:flex">
      <div className="p-6 border-b border-border bg-gradient-to-r from-blue-900 via-slate-800 to-slate-900 text-primary-foreground">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{appConfig.title}</h1>
            <p className="text-sm opacity-90">{settings.orgName}</p>
          </div>
        </div>
      </div>
      <div className="p-4 flex-1">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link href={item.href} passHref>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={cn(
                    "w-full flex items-center justify-start px-4 py-3 h-auto transition-all duration-200",
                    pathname === item.href ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted',
                    "group"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center mr-3 transition-colors",
                    pathname === item.href ? 'bg-primary/10' : 'bg-muted group-hover:bg-muted/80'
                  )}>
                    <item.icon className={cn("w-5 h-5 transition-colors", pathname === item.href ? 'text-primary' : 'text-muted-foreground group-hover:text-primary')} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-card-foreground">{item.label}</span>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};


const EditProfileDialog = ({ children }: { children: React.ReactNode }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    
    const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

    const [displayName, setDisplayName] = useState('');
    
    useEffect(() => {
        if (userProfile) {
            setDisplayName(userProfile.name || user?.displayName || '');
        } else if (user) {
            setDisplayName(user.displayName || '');
        }
    }, [user, userProfile]);

    const handleSave = async () => {
        if (user && userDocRef) {
            try {
                // Update Firebase Auth profile
                if(user.displayName !== displayName) {
                    await updateProfile(user, { displayName });
                }
                
                // Update Firestore document
                const updatedData = { ...userProfile, name: displayName };
                setDocumentNonBlocking(userDocRef, updatedData, { merge: true });

                toast({ title: 'Profile Updated', description: 'Your display name has been changed.' });
            } catch (error) {
                console.error("Profile update error:", error);
                toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
            }
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>
                 {isProfileLoading ? (
                    <div className="space-y-4 py-4">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                 ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Display Name</Label>
                            <Input
                                id="displayName"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your name"
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={user?.email || ''} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Input id="role" value={userProfile?.role || 'Loading...'} disabled />
                        </div>
                    </div>
                 )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button onClick={handleSave} disabled={isProfileLoading}>Save Changes</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const AppHeader = () => {
  const { pageTitle } = useAppLayout();
  const { settings, kpiData, cascadedKpis } = useKpiData();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const [openCommand, setOpenCommand] = React.useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpenCommand((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleLogout = () => {
    auth.signOut();
    router.push('/login');
  };
  
  const runCommand = (command: () => void) => {
    setOpenCommand(false)
    command()
  }

  return (
    <>
    <header className="bg-card shadow-sm border-b border-border px-4 sm:px-6 py-4 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <nav className="flex flex-col h-full bg-card">
                <div className="p-6 border-b border-border bg-gradient-to-r from-blue-900 via-slate-800 to-slate-900 text-white">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold">{appConfig.title}</h1>
                      <p className="text-sm opacity-90">{settings.orgName}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 flex-1">
                  <ul className="space-y-2">
                    {navItems.map((item) => (
                      <li key={item.label}>
                         <Link href={item.href} passHref>
                          <Button variant="ghost" className="w-full flex items-center justify-start px-4 py-3 h-auto hover:bg-muted transition-all duration-200 group">
                             <div className="w-10 h-10 bg-muted group-hover:bg-muted/80 rounded-lg flex items-center justify-center mr-3">
                               <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                             </div>
                             <div className="text-left">
                               <span className="font-semibold text-card-foreground">{item.label}</span>
                               <p className="text-xs text-muted-foreground">{item.description}</p>
                             </div>
                           </Button>
                         </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{pageTitle}</h2>
            <p className="text-sm text-muted-foreground mt-1">งวดปัจจุบัน: {settings.period}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="relative hidden md:block">
            <Button variant="outline" onClick={() => setOpenCommand(true)} className="w-40 sm:w-64 justify-start text-muted-foreground">
                <Search className="w-4 h-4 mr-2" />
                ค้นหา KPI...
                 <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
            </Button>
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{headerData.alertCount}</span>
            </Button>
          </div>
          <div className="flex items-center space-x-3">
            {isUserLoading ? (
              <div className="hidden sm:flex items-center space-x-3">
                <div className="flex flex-col items-end">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            ) : user ? (
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <div className="flex items-center space-x-3 cursor-pointer">
                          <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-foreground">{user.isAnonymous ? 'Anonymous User' : (user.displayName || user.email)}</p>
                            <p className="text-xs text-muted-foreground">{user.isAnonymous ? 'Guest' : 'Member'}</p>
                          </div>
                          <Avatar>
                            <AvatarFallback className="bg-gradient-to-r from-primary to-secondary text-white font-semibold">
                              {user.isAnonymous ? 'A' : (user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                      </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <EditProfileDialog>
                         <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <UserIcon className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                         </DropdownMenuItem>
                      </EditProfileDialog>
                      <DropdownMenuItem onClick={handleLogout}>
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Log out</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                 <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-foreground">{appConfig.ceoName}</p>
                  <p className="text-xs text-muted-foreground">{appConfig.ceoTitle}</p>
                </div>
                <Avatar>
                  <AvatarFallback className="bg-gradient-to-r from-primary to-secondary text-white font-semibold">S</AvatarFallback>
                </Avatar>
              </>
            )}
          </div>
          <div className="hidden lg:flex items-center space-x-2">
            <div className="w-3 h-3 bg-success rounded-full pulse-dot"></div>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </div>
    </header>
     <CommandDialog open={openCommand} onOpenChange={setOpenCommand}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
             {navItems.map(item => (
                <CommandItem key={item.href} value={item.label} onSelect={() => runCommand(() => router.push(item.href))}>
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                </CommandItem>
            ))}
          </CommandGroup>
          {kpiData && (
            <CommandGroup heading="Corporate KPIs">
                 {kpiData.map(kpi => (
                    <CommandItem key={kpi.id} value={kpi.measure} onSelect={() => runCommand(() => router.push('/cascade'))}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        <span>{kpi.measure}</span>
                    </CommandItem>
                ))}
            </CommandGroup>
          )}
          {cascadedKpis && (
            <CommandGroup heading="Cascaded KPIs">
                 {cascadedKpis.map(kpi => (
                    <CommandItem key={kpi.id} value={`${kpi.measure} (${kpi.department})`} onSelect={() => runCommand(() => router.push('/cascade'))}>
                        <span>{kpi.measure}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({kpi.department})</span>
                    </CommandItem>
                ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [pageTitle, setPageTitle] = useState('Dashboard');
  const { isUserLoading } = useUser();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setPageTitle(pageTitle);
  }, [pageTitle]);

  useEffect(() => {
      setIsClient(true);
  }, []);

  if (isUserLoading && isClient) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-background">
              <div className="flex flex-col items-center space-y-4">
                  <ShieldCheck className="h-12 w-12 text-primary animate-pulse" />
                  <p className="text-muted-foreground">Initializing Application...</p>
              </div>
          </div>
      );
  }

  return (
    <AppLayoutContext.Provider value={{ pageTitle, setPageTitle }}>
      <KpiDataProvider>
        <AuthGate>
          <div className="h-full flex bg-background">
            <AppSidebar />
            <main className="flex-1 overflow-auto">
              <AppHeader />
              <div className="p-6">
                {children}
              </div>
            </main>
          </div>
        </AuthGate>
      </KpiDataProvider>
    </AppLayoutContext.Provider>
  );
}
