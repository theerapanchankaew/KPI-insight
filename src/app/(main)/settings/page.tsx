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
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { navItems } from '@/lib/data/layout-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


type Role = 'Admin' | 'Manager' | 'Employee';

interface UserPermissions {
  role: Role;
  menuAccess: { [key: string]: boolean };
}

interface AllUserPermissions {
  [key: string]: UserPermissions;
}

const defaultPermissions: { [key in Role]: { [key: string]: boolean } } = {
  Admin: navItems.reduce((acc, item) => ({ ...acc, [item.href]: true }), {}),
  Manager: {
    '/dashboard': true,
    '/cascade': true,
    '/portfolio': true,
    '/submit': false,
    '/approvals': true,
    '/reports': true,
    '/kpi-import': false,
    '/settings': false,
  },
  Employee: {
    '/dashboard': true,
    '/cascade': false,
    '/portfolio': true,
    '/submit': true,
    '/approvals': false,
    '/reports': false,
    '/kpi-import': false,
    '/settings': false,
  },
};

const AddUserDialog = ({ isOpen, onOpenChange, onAddUser }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; onAddUser: (user: any) => void }) => {
    const [newUser, setNewUser] = useState({ name: '', department: '', position: '', manager: '' });

    const handleAdd = () => {
        if (newUser.name && newUser.department && newUser.position) {
            onAddUser({
                id: `user-${Date.now()}`,
                'ชื่อ-นามสกุล': newUser.name,
                'แผนก': newUser.department,
                'ตำแหน่ง': newUser.position,
                'ผู้บังคับบัญชา': newUser.manager,
            });
            onOpenChange(false);
            setNewUser({ name: '', department: '', position: '', manager: '' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-user-name">Name</Label>
                        <Input id="new-user-name" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Full Name" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-user-department">Department</Label>
                        <Input id="new-user-department" value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} placeholder="e.g., Sales" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-user-position">Position</Label>
                        <Input id="new-user-position" value={newUser.position} onChange={e => setNewUser({ ...newUser, position: e.target.value })} placeholder="e.g., Sales Manager" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-user-manager">Manager</Label>
                        <Input id="new-user-manager" value={newUser.manager} onChange={e => setNewUser({ ...newUser, manager: e.target.value })} placeholder="Manager's Name" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleAdd}>Add User</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function SettingsPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();
  const { settings, setSettings, orgData, setOrgData } = useKpiData();

  // State for General Settings
  const [orgName, setOrgName] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState("รายไตรมาส (Quarterly)");
  const [periodDate, setPeriodDate] = useState<Date | undefined>();
  const [defaultCurrency, setDefaultCurrency] = useState("thb");

  // State for Notification Settings
  const [kpiAlerts, setKpiAlerts] = useState(true);
  const [approvalNotifications, setApprovalNotifications] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);

  // State for User Roles and Permissions
  const [userPermissions, setUserPermissions] = useState<AllUserPermissions>({});
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);

  useEffect(() => {
    setPageTitle('Settings');
  }, [setPageTitle]);

  useEffect(() => {
    if (settings) {
      setOrgName(settings.orgName);
      setCurrentPeriod(settings.period);
      setDefaultCurrency(settings.currency);
      if (settings.period === 'รายเดือน (Monthly)' && settings.periodDate) {
        setPeriodDate(new Date(settings.periodDate));
      }
    }
  }, [settings]);

  useEffect(() => {
    if (orgData?.employees) {
      const initialPermissions: AllUserPermissions = {};
      orgData.employees.forEach(employee => {
        // A simple heuristic to assign a default role. This can be improved.
        const role: Role = employee.position.toLowerCase().includes('manager') || employee.position.toLowerCase().includes('ผู้จัดการ') ? 'Manager' : 'Employee';
        // Check if permissions for this user already exist to avoid overwriting them
        if (!userPermissions[employee.id]) {
            initialPermissions[employee.id] = {
                role,
                menuAccess: defaultPermissions[role],
            };
        }
      });
      // Merge new permissions without overwriting existing ones unless necessary
      setUserPermissions(prev => ({...prev, ...initialPermissions}));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgData]);

  const handleGeneralSave = () => {
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
      description: "Your general settings have been updated.",
    });
  };

  const handleNotificationSave = () => {
    toast({
      title: "Preferences Saved",
      description: "Your notification preferences have been updated.",
    });
  };
  
  const handleRoleChange = (userId: string, role: Role) => {
    setUserPermissions(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        role,
        menuAccess: defaultPermissions[role], // Apply default permissions for the new role
      },
    }));
  };

  const handlePermissionChange = (userId: string, menuHref: string, checked: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        menuAccess: {
          ...prev[userId].menuAccess,
          [menuHref]: checked,
        },
      },
    }));
  };

  const handleSavePermissions = () => {
    console.log("Saving user permissions:", userPermissions);
    toast({
        title: "User Permissions Saved",
        description: "User roles and menu access have been successfully updated.",
    });
  };

  const handleAddUser = (rawUser: any) => {
    const newUser = {
        id: rawUser.id.toString(),
        name: rawUser['ชื่อ-นามสกุล'],
        department: rawUser['แผนก'],
        position: rawUser['ตำแหน่ง'],
        manager: rawUser['ผู้บังคับบัญชา']
    };

    if (orgData) {
        const updatedEmployees = [...orgData.employees, newUser];
        setOrgData({ employees: updatedEmployees });
        toast({ title: 'User Added', description: `${newUser.name} has been added.` });
    }
  };

  const handleDeleteUser = (userId: string) => {
      if (orgData) {
          const updatedEmployees = orgData.employees.filter(emp => emp.id !== userId);
          setOrgData({ employees: updatedEmployees });

          setUserPermissions(prev => {
              const newPerms = { ...prev };
              delete newPerms[userId];
              return newPerms;
          });

          toast({ title: 'User Deleted', description: 'The user has been removed.', variant: 'destructive' });
      }
  };

  return (
    <div className="fade-in space-y-6">
      <h3 className="text-xl font-semibold text-gray-800">Settings</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
              <CardHeader>
                  <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-period">Current Period</Label>
                        <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
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
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="default-currency">Default Currency</Label>
                      <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
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
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User &amp; Permission Management</CardTitle>
              <CardDescription>Manage roles and grant menu access for each user.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setAddUserModalOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[250px]">User</TableHead>
                    <TableHead className="w-[150px]">Role</TableHead>
                    {navItems.map(item => (
                      <TableHead key={item.href} className="text-center">{item.label}</TableHead>
                    ))}
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orgData?.employees || []).map(employee => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{employee.name}</p>
                            <p className="text-xs text-muted-foreground">{employee.department}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={userPermissions[employee.id]?.role || 'Employee'}
                          onValueChange={(role: Role) => handleRoleChange(employee.id, role)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {navItems.map(item => (
                        <TableCell key={item.href} className="text-center">
                          <Checkbox
                            checked={userPermissions[employee.id]?.menuAccess[item.href] || false}
                            onCheckedChange={(checked) => handlePermissionChange(employee.id, item.href, !!checked)}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the user and their associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(employee.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSavePermissions}>Save Permissions</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <AddUserDialog isOpen={isAddUserModalOpen} onOpenChange={setAddUserModalOpen} onAddUser={handleAddUser} />
    </div>
  );
}
