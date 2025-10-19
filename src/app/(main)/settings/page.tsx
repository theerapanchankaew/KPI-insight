"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();

  // State for General Settings
  const [orgName, setOrgName] = useState("บริษัท ABC จำกัด");
  const [currentPeriod, setCurrentPeriod] = useState("q4-2024");
  const [defaultCurrency, setDefaultCurrency] = useState("thb");

  // State for Notification Settings
  const [kpiAlerts, setKpiAlerts] = useState(true);
  const [approvalNotifications, setApprovalNotifications] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);

  useEffect(() => {
    setPageTitle('Settings');
  }, [setPageTitle]);

  const handleGeneralSave = () => {
    // In a real app, you'd save this to a backend or local storage
    toast({
      title: "Settings Saved",
      description: "Your general settings have been updated.",
    });
  };

  const handleNotificationSave = () => {
    // In a real app, you'd save this to a backend or user profile
    toast({
      title: "Preferences Saved",
      description: "Your notification preferences have been updated.",
    });
  };

  return (
    <div className="fade-in space-y-6">
      <h3 className="text-xl font-semibold text-gray-800">Settings</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="current-period">Current Period</Label>
                    <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
                        <SelectTrigger id="current-period">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="q4-2024">Q4 2024</SelectItem>
                            <SelectItem value="q1-2025">Q1 2025</SelectItem>
                            <SelectItem value="q2-2025">Q2 2025</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="default-currency">Default Currency</Label>
                    <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                        <SelectTrigger id="default-currency">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="thb">THB (฿)</SelectItem>
                            <SelectItem value="usd">USD ($)</SelectItem>
                            <SelectItem value="eur">EUR (€)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="pt-4">
                    <Button onClick={handleGeneralSave}>Save Changes</Button>
                </div>
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
  );
}
