"use client";

import React, { useState, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Bell,
  CheckCircle2,
  Menu,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { appConfig, navItems, headerData } from '@/lib/kpi-data';
import { KpiDataProvider, useKpiData } from '@/context/KpiDataContext';

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

  return (
    <nav className="w-72 bg-white shadow-xl border-r border-gray-200 flex-col hidden lg:flex">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-primary to-secondary text-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{appConfig.title}</h1>
            <p className="text-sm opacity-90">{appConfig.companyName}</p>
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
                    pathname === item.href ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100',
                    "group"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center mr-3",
                    pathname === item.href ? 'bg-primary/10' : 'bg-gray-100 group-hover:bg-gray-200'
                  )}>
                    <item.icon className={cn("w-5 h-5", pathname === item.href ? 'text-primary' : 'text-gray-500 group-hover:text-primary')} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-800">{item.label}</span>
                    <p className="text-xs text-gray-500">{item.description}</p>
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

const AppHeader = () => {
  const { pageTitle } = useAppLayout();
  const currentNavItem = navItems.find(item => item.label === pageTitle);
  const currentPeriod = currentNavItem ? headerData.currentPeriod : '';

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
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
              <nav className="flex flex-col h-full bg-white">
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-primary to-secondary text-white">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold">{appConfig.title}</h1>
                      <p className="text-sm opacity-90">{appConfig.companyName}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 flex-1">
                  <ul className="space-y-2">
                    {navItems.map((item) => (
                      <li key={item.label}>
                         <Link href={item.href} passHref>
                          <Button variant="ghost" className="w-full flex items-center justify-start px-4 py-3 h-auto hover:bg-gray-100 transition-all duration-200 group">
                             <div className="w-10 h-10 bg-gray-100 group-hover:bg-gray-200 rounded-lg flex items-center justify-center mr-3">
                               <item.icon className="w-5 h-5 text-gray-500 group-hover:text-primary" />
                             </div>
                             <div className="text-left">
                               <span className="font-semibold text-gray-800">{item.label}</span>
                               <p className="text-xs text-gray-500">{item.description}</p>
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
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{pageTitle}</h2>
            <p className="text-sm text-gray-600 mt-1">{headerData.currentPeriod}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="relative hidden md:block">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input type="text" placeholder="ค้นหา KPI..." className="w-40 sm:w-64 pl-10 pr-4 py-2" />
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{headerData.alertCount}</span>
            </Button>
          </div>
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-800">{appConfig.ceoName}</p>
              <p className="text-xs text-gray-500">{appConfig.ceoTitle}</p>
            </div>
            <Avatar>
              <AvatarFallback className="bg-gradient-to-r from-primary to-secondary text-white font-semibold">S</AvatarFallback>
            </Avatar>
          </div>
          <div className="hidden lg:flex items-center space-x-2">
            <div className="w-3 h-3 bg-success rounded-full pulse-dot"></div>
            <span className="text-xs text-gray-500">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
};


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [pageTitle, setPageTitle] = useState('Dashboard');

  return (
    <AppLayoutContext.Provider value={{ pageTitle, setPageTitle }}>
      <KpiDataProvider>
        <div className="h-full flex bg-gray-50">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            <AppHeader />
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </KpiDataProvider>
    </AppLayoutContext.Provider>
  );
}
