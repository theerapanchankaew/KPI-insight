
"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useKpiData } from '@/context/KpiDataContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, ShieldAlert } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface UserProfile {
  role?: 'Admin' | 'Employee' | 'Manager';
}

export default function SettingsPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();
  const { settings, setSettings, isSettingsLoading } = useKpiData();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  // State for General Settings
  const [orgName, setOrgName] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState("รายไตรมาส (Quarterly)");
  const [periodDate, setPeriodDate] = useState<Date | undefined>();
  const [defaultCurrency, setDefaultCurrency] = useState("thb");

  // State for Notification Settings
  const [kpiAlerts, setKpiAlerts] = useState(true);
  const [approvalNotifications, setApprovalNotifications] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'Admin';


  useEffect(() => {
    setPageTitle('Settings');
  }, [setPageTitle]);
  
  useEffect(() => {
    if (settings && !isSettingsLoading) {
      setOrgName(settings.orgName);
      setCurrentPeriod(settings.period);
      setDefaultCurrency(settings.currency);
      if (settings.periodDate) {
        try {
          setPeriodDate(new Date(settings.periodDate));
        } catch (e) {
          console.error("Invalid date from settings:", settings.periodDate);
          setPeriodDate(undefined);
        }
      }
    }
  }, [settings, isSettingsLoading]);

  const handleGeneralSave = () => {
    if (!isAdmin) {
      toast({ title: 'Permission Denied', description: 'Only admins can change general settings.', variant: 'destructive' });
      return;
    }
    const newSettings: any = { 
      orgName, 
      period: currentPeriod, 
      currency: defaultCurrency 
    };
    if (currentPeriod === 'รายเดือน (Monthly)') {
      newSettings.periodDate = periodDate?.toISOString();
    }
    setSettings(newSettings);
    toast({
      title: "Settings Saved",
      description: "Your general settings have been updated and stored in Firestore.",
    });
  };

  const handleNotificationSave = () => {
    toast({
      title: "Preferences Saved",
      description: "Your notification preferences have been updated.",
    });
  };
  
  const isLoading = isSettingsLoading || isAuthLoading || isProfileLoading;

  return (
    <div className="fade-in space-y-6">
      <h3 className="text-xl font-semibold text-gray-800">Settings</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
              <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  {!isLoading && !isAdmin && (
                    <CardDescription className="!mt-2 flex items-center gap-2 text-destructive">
                      <ShieldAlert className="h-4 w-4" />
                      These settings are read-only. Only an Admin can make changes.
                    </CardDescription>
                  )}
              </CardHeader>
              <CardContent className="space-y-6">
                 {isLoading ? (
                    <div className="space-y-6">
                        <div className="space-y-2">
                           <Skeleton className="h-4 w-24" />
                           <Skeleton className="h-10 w-full" />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-10 w-full" />
                           </div>
                         </div>
                         <div className="space-y-2">
                           <Skeleton className="h-4 w-24" />
                           <Skeleton className="h-10 w-48" />
                         </div>
                         <Skeleton className="h-10 w-32" />
                    </div>
                 ) : (
                   <>
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isAdmin} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="current-period">Current Period</Label>
                          <Select value={currentPeriod} onValueChange={setCurrentPeriod} disabled={!isAdmin}>
                              <SelectTrigger id="current-period">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="รายเดือน (Monthly)">รายเดือน (Monthly)</SelectItem>
                                  <SelectItem value="รายไตรมาส (Quarterly)">รายไตรมาส (Quarterly)</SelectItem>
                                  <SelectItem value="รายปี (Yearly)">รายปี (Yearly)</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      {currentPeriod === 'รายเดือน (Monthly)' && (
                        <div className="space-y-2">
                          <Label htmlFor="period-date">Select Month</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !periodDate && "text-muted-foreground"
                                )}
                                disabled={!isAdmin}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {periodDate ? format(periodDate, "MMMM yyyy") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={periodDate}
                                onSelect={setPeriodDate}
                                initialFocus
                                disabled={!isAdmin}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="default-currency">Default Currency</Label>
                        <Select value={defaultCurrency} onValueChange={setDefaultCurrency} disabled={!isAdmin}>
                            <SelectTrigger id="default-currency" className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="thb">THB (฿)</SelectItem>
                                <SelectItem value="usd">USD ($)</SelectItem>
                                <SelectItem value="eur">EUR (€)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {isAdmin && (
                      <div className="pt-4">
                          <Button onClick={handleGeneralSave}>Save Changes</Button>
                      </div>
                    )}
                   </>
                 )}
              </CardContent>
          </Card>
           <Card>
              <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="font-medium text-gray-800">KPI Alerts</p>
                          <p className="text-sm text-gray-600">แจ้งเตือนเมื่อ KPI ต่ำกว่าเป้า</p>
                      </div>
                      <Switch checked={kpiAlerts} onCheckedChange={setKpiAlerts} />
                  </div>
                   <div className="flex items-center justify-between">
                      <div>
                          <p className="font-medium text-gray-800">Approval Notifications</p>
                          <p className="text-sm text-gray-600">แจ้งเตือนเมื่อมี KPI รออนุมัติ</p>
                      </div>
                      <Switch checked={approvalNotifications} onCheckedChange={setApprovalNotifications} />
                  </div>
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="font-medium text-gray-800">Weekly Reports</p>
                          <p className="text-sm text-gray-600">ส่งรายงานสรุปทุกสัปดาห์</p>
                      </div>
                      <Switch checked={weeklyReports} onCheckedChange={setWeeklyReports} />
                  </div>
                  <div className="pt-4">
                      <Button onClick={handleNotificationSave}>Save Preferences</Button>
                  </div>
              </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
