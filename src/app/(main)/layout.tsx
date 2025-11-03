
"use client";

import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
import { appConfig, navItems } from '@/lib/data/layout-data';
import { KpiDataProvider, useKpiData } from '@/context/KpiDataContext';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthGate } from '@/app/auth-gate';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Employee, User, Department, Position } from '@/context/KpiDataContext';


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
    const { user: authUser } = useUser();
    const { employees, departments, positions } = useKpiData();
    const { toast } = useToast();
    
    const employee = useMemo(() => {
        if (!authUser || !employees) return null;
        return employees.find(e => e.id === authUser.uid);
    }, [authUser, employees]);

    const department = useMemo(() => {
        if (!employee || !departments) return null;
        return departments.find(d => d.id === employee.departmentId);
    }, [employee, departments]);

    const position = useMemo(() => {
        if (!employee || !positions) return null;
        return positions.find(p => p.id === employee.positionId);
    }, [employee, positions]);

    const [displayName, setDisplayName] = useState('');
    
    useEffect(() => {
        if (employee) {
            setDisplayName(employee.name || '');
        } else if (authUser) {
            setDisplayName(authUser.displayName || '');
        }
    }, [authUser, employee]);

    const handleSave = async () => {
       toast({ title: 'Read-Only', description: 'Profile information is managed by an administrator.', variant: 'default' });
    };
    
    const isLoading = !employee || !department || !position;

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>My Profile</DialogTitle>
                </DialogHeader>
                 {isLoading ? (
                    <div className="space-y-4 py-4">
                        <Skeleton className="h-4 w-1/4" /> <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-4 w-1/4" /> <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-4 w-1/4" /> <Skeleton className="h-10 w-full" />
                    </div>
                 ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input value={employee?.name} disabled />
                        </div>
                         <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={authUser?.email || ''} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Input value={department?.name || 'N/A'} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Position</Label>
                            <Input value={position?.name || 'N/A'} disabled />
                        </div>
                    </div>
                 )}
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const AppHeader = () => {
  const { pageTitle } = useAppLayout();
  const { settings, employees, kpiData, cascadedKpis } = useKpiData();
  const { user: authUser, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const [openCommand, setOpenCommand] = React.useState(false);
  
  const currentEmployee = useMemo(() => {
    if (!authUser || !employees) return null;
    return employees.find(e => e.id === authUser.uid);
  }, [authUser, employees]);

  const notificationCount = 0; // Placeholder

  React.useEffect(() => {
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
    if (auth) auth.signOut();
    router.push('/login');
  };
  
  const runCommand = React.useCallback((command: () => void) => {
    setOpenCommand(false)
    command()
  }, [])

  const displayName = currentEmployee?.name || authUser?.displayName || 'User';
  // Note: Role is now fetched from the employee's position's default roles for display
  const displayRole = "Member" // Placeholder as user role is more complex now

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
                Search...
                 <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
            </Button>
          </div>
          <div className="relative">
             <Button asChild variant="ghost" size="icon" className="relative">
              <Link href="/approvals">
                <Bell className="w-6 h-6" />
                {notificationCount > 0 && (
                   <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notificationCount}
                   </span>
                )}
              </Link>
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
            ) : authUser ? (
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <div className="flex items-center space-x-3 cursor-pointer">
                          <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-foreground">{authUser.isAnonymous ? 'Anonymous' : displayName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{displayRole}</p>
                          </div>
                          <Avatar>
                            <AvatarFallback className="bg-gradient-to-r from-primary to-secondary text-white font-semibold">
                              {authUser.isAnonymous ? 'A' : displayName.charAt(0).toUpperCase()}
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
               <Skeleton className="h-10 w-32" />
            )}
          </div>
          <div className="hidden lg:flex items-center space-x-2">
            <div className="w-3 h-3 bg-success rounded-full pulse-dot"></div>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </div>
    </header>
    {/* Command Palette Dialog would go here, simplified for brevity */}
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
