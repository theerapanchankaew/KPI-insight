
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, AlertTriangle, Send } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { navItems } from '@/lib/data/layout-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, WithId } from '@/firebase';
import { collection, doc, query, where, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';

type Role = 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee';

export interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  manager: string;
}

export interface AppUser {
  id: string;
  email?: string;
  role: Role;
  menuAccess: { [key: string]: boolean };
}
interface IndividualKpiBase {
    employeeId: string;
    kpiId: string;
    kpiMeasure: string;
    weight: number;
    status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
    notes?: string;
}
interface AssignedCascadedKpi extends IndividualKpiBase { type: 'cascaded'; target: string; }
interface CommittedKpi extends IndividualKpiBase { type: 'committed'; task: string; targets: { [key: string]: string }; }
type IndividualKpi = AssignedCascadedKpi | CommittedKpi;


// Represents the merged data from employees and users collections
type ManagedUser = Employee & Partial<AppUser>;


const defaultPermissions: { [key in Role]: { [key: string]: boolean } } = {
  Admin: navItems.reduce((acc, item) => ({ ...acc, [item.href]: true }), {}),
  VP: {
    '/dashboard': true,
    '/cascade': true,
    '/portfolio': true,
    '/submit': false,
    '/approvals': true,
    '/reports': true,
    '/kpi-import': false,
    '/user-management': true,
    '/settings': false,
  },
  AVP: {
    '/dashboard': true,
    '/cascade': true,
    '/portfolio': true,
    '/submit': false,
    '/approvals': true,
    '/reports': true,
    '/kpi-import': false,
    '/user-management': false,
    '/settings': false,
  },
  Manager: {
    '/dashboard': true,
    '/cascade': true,
    '/portfolio': true,
    '/submit': false,
    '/approvals': true,
    '/reports': true,
    '/kpi-import': false,
    '/user-management': false,
    '/settings': false,
  },
  Employee: {
    '/dashboard': true,
    '/cascade': false,
    '/portfolio': true,
    '/submit': true,
    '/approvals': false,
    '/reports': true, // Changed from false
    '/kpi-import': false,
    '/user-management': false,
    '/settings': false,
  },
};

const AddUserDialog = ({ isOpen, onOpenChange, onAddUser }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; onAddUser: (user: Omit<Employee, 'id'>) => void }) => {
    const [newUser, setNewUser] = useState({ name: '', department: '', position: '', manager: '' });

    const handleAdd = () => {
        if (newUser.name && newUser.department && newUser.position) {
            onAddUser(newUser as Omit<Employee, 'id'>);
            onOpenChange(false);
            setNewUser({ name: '', department: '', position: '', manager: '' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Employee</DialogTitle>
                    <DialogDescription>
                        This will create an employee document in Firestore. If the employee needs to log in, they must sign up separately with an email that can be matched to their profile.
                    </DialogDescription>
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
                    <Button onClick={handleAdd}>Add Employee</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function UserManagementPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  
  const userProfileRef = useMemoFirebase(() => {
      if(!user || !firestore) return null;
      return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileRef);

  const isAdmin = useMemo(() => userProfile?.role === 'Admin', [userProfile]);

  useEffect(() => {
    setPageTitle('User Management');
  }, [setPageTitle]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null; // Only query if user is admin
    return collection(firestore, 'users');
  }, [firestore, isAdmin]);
  
  const employeesQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null; // Only query if user is admin
    return collection(firestore, 'employees');
  }, [firestore, isAdmin]);

  const { data: usersData, isLoading: isUsersLoading, error: usersError } = useCollection<WithId<AppUser>>(usersQuery);
  const { data: employeesData, isLoading: isEmployeesLoading, error: employeesError } = useCollection<WithId<Employee>>(employeesQuery);

  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin || isEmployeesLoading || isUsersLoading) {
        setManagedUsers([]);
        return;
    };

    const usersMap = new Map<string, AppUser>();
    if (usersData) {
        usersData.forEach(user => usersMap.set(user.id, user));
    }

    if (employeesData) {
        const merged: ManagedUser[] = employeesData.map(employee => {
            const userAccount = usersMap.get(employee.id);
            return {
                ...employee,
                email: userAccount?.email,
                role: userAccount?.role || 'Employee', // Default to Employee if no user record
                menuAccess: userAccount?.menuAccess || defaultPermissions.Employee
            };
        });
        setManagedUsers(merged);
    } else {
        setManagedUsers([]);
    }

  }, [employeesData, usersData, isAdmin, isEmployeesLoading, isUsersLoading]);
  
  const handleRoleChange = (userId: string, role: Role) => {
    setManagedUsers(prev => prev.map(user => 
      user.id === userId 
      ? { ...user, role, menuAccess: defaultPermissions[role] }
      : user
    ));
  };

  const handlePermissionChange = (userId: string, menuHref: string, checked: boolean) => {
    setManagedUsers(prev => prev.map(user => 
        user.id === userId && user.menuAccess
        ? { ...user, menuAccess: { ...user.menuAccess, [menuHref]: checked } }
        : user
    ));
  };

  const handleSavePermissions = () => {
    if (!firestore || !isAdmin) {
        toast({ title: 'Permission Denied', description: 'Only admins can save permissions.', variant: 'destructive'});
        return;
    }

    let usersUpdated = 0;
    managedUsers.forEach(user => {
      // We only write to the 'users' collection for roles and permissions
      if(user.email) { // Only save if there is a corresponding user account
          const userRef = doc(firestore, 'users', user.id);
          const userDataToSave: Partial<AppUser> = {
              role: user.role,
              menuAccess: user.menuAccess,
          };
          setDocumentNonBlocking(userRef, userDataToSave, { merge: true });
          usersUpdated++;
      }
    });
    
    toast({
        title: "User Permissions Saved",
        description: `Permissions for ${usersUpdated} user(s) have been updated in the 'users' collection.`,
    });
  };

  const handleAddUser = (newUser: Omit<Employee, 'id'>) => {
    if (!firestore || !isAdmin) {
        toast({ title: 'Permission Denied', description: 'Only admins can add employees.', variant: 'destructive'});
        return;
    }
    const employeesCollection = collection(firestore, 'employees');
    // For non-logged-in users, create a descriptive ID.
    const newId = newUser.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-5);
    const employeeDocRef = doc(employeesCollection, newId);
    setDocumentNonBlocking(employeeDocRef, {id: newId, ...newUser}, { merge: true });
    
    toast({ title: 'Employee Added', description: `${newUser.name} has been added.` });
  };

  const handleDeleteUser = (employeeId: string) => {
      if (!firestore || !isAdmin) {
        toast({ title: 'Permission Denied', description: 'Only admins can delete users.', variant: 'destructive'});
        return;
      }
      // Delete from employees collection
      const employeeRef = doc(firestore, 'employees', employeeId);
      deleteDocumentNonBlocking(employeeRef);

      // Also delete from users collection if exists
      const userRef = doc(firestore, 'users', employeeId);
      deleteDocumentNonBlocking(userRef);

      toast({ title: 'User Removed', description: 'The user and employee records have been removed.', variant: 'destructive' });
  };

  const handleForceSubmit = async (employee: ManagedUser) => {
    if (!firestore || !isAdmin) {
        toast({ title: 'Permission Denied', variant: 'destructive'});
        return;
    }
    
    // 1. Find a 'Draft' KPI for this user
    const q = query(
        collection(firestore, 'individual_kpis'), 
        where('employeeId', '==', employee.id),
        where('status', '==', 'Draft'),
        limit(1)
    );

    const kpiSnapshot = await getDocs(q);

    if (kpiSnapshot.empty) {
        toast({ title: 'No Draft KPI Found', description: `${employee.name} has no available KPIs in 'Draft' status to fast-track.`, variant: 'destructive' });
        return;
    }

    const kpiDoc = kpiSnapshot.docs[0];
    const kpiData = kpiDoc.data() as IndividualKpi;

    // 2. Update KPI status to 'In-Progress'
    const kpiRef = doc(firestore, 'individual_kpis', kpiDoc.id);
    setDocumentNonBlocking(kpiRef, { status: 'In-Progress' }, { merge: true });

    // 3. Create a mock submission
    const submissionData = {
        kpiId: kpiDoc.id,
        kpiMeasure: kpiData.kpiMeasure,
        submittedBy: employee.id,
        submitterName: employee.name,
        department: employee.department,
        actualValue: `95%`, // Mock data
        targetValue: kpiData.type === 'cascaded' ? kpiData.target : '5-level scale',
        notes: 'This is an admin-forced submission for testing purposes.',
        submissionDate: serverTimestamp(),
        status: 'Manager Review' as const,
    };
    
    addDocumentNonBlocking(collection(firestore, 'kpi_submissions'), submissionData);

    toast({
        title: 'KPI Fast-Tracked!',
        description: `A mock submission for "${kpiData.kpiMeasure}" has been created for ${employee.name} and is now in the Action Center.`,
        duration: 7000
    });
  };

  const isLoading = isAuthLoading || isProfileLoading || (isAdmin && (isUsersLoading || isEmployeesLoading));
  const error = usersError || employeesError;

  const renderContent = () => {
    if (isLoading) {
       return (
         <TableRow>
            <TableCell colSpan={navItems.length + 4} className="h-96">
               <div className="flex items-center justify-center space-x-2">
                 <Skeleton className="h-5 w-5 rounded-full" />
                 <p className="text-muted-foreground">Loading user data...</p>
               </div>
            </TableCell>
         </TableRow>
       )
    }

    if (!isAdmin) {
       return (
         <TableRow>
            <TableCell colSpan={navItems.length + 4} className="h-96">
               <div className="flex flex-col items-center justify-center space-y-3 text-center">
                 <AlertTriangle className="h-10 w-10 text-destructive" />
                 <h3 className="text-lg font-semibold">Access Denied</h3>
                 <p className="text-muted-foreground max-w-md">
                    You do not have the necessary permissions to view this page. Please contact an administrator.
                 </p>
               </div>
            </TableCell>
         </TableRow>
       )
    }
    
    if (error) {
       return (
         <TableRow>
            <TableCell colSpan={navItems.length + 4} className="h-96">
               <div className="flex flex-col items-center justify-center space-y-3 text-center">
                 <AlertTriangle className="h-10 w-10 text-destructive" />
                 <h3 className="text-lg font-semibold">Error Loading Data</h3>
                 <p className="text-muted-foreground max-w-md">
                    Could not load user data. {error.message}
                 </p>
               </div>
            </TableCell>
         </TableRow>
       )
    }
    
    if (managedUsers.length === 0) {
        return (
            <TableRow>
                <TableCell colSpan={navItems.length + 4} className="h-96 text-center text-muted-foreground">
                    No users found. Add an employee or have a user sign up.
                </TableCell>
            </TableRow>
        );
    }

    return managedUsers.map(employee => (
      <TableRow key={employee.id}>
        <TableCell>
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback>{employee.name ? employee.name.charAt(0).toUpperCase() : '?'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{employee.name}</p>
              <p className="text-xs text-muted-foreground">{employee.department}</p>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm">{employee.position}</span>
        </TableCell>
        <TableCell>
          <Select
            value={employee.role || 'Employee'}
            onValueChange={(role: Role) => handleRoleChange(employee.id, role)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="VP">VP</SelectItem>
              <SelectItem value="AVP">AVP</SelectItem>
              <SelectItem value="Manager">Manager</SelectItem>
              <SelectItem value="Employee">Employee</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        {navItems.map(item => (
          <TableCell key={item.href} className="text-center">
            <Checkbox
              checked={employee.menuAccess ? (employee.menuAccess[item.href] || false) : false}
              onCheckedChange={(checked) => handlePermissionChange(employee.id, item.href, !!checked)}
            />
          </TableCell>
        ))}
        <TableCell className="text-center">
           <div className='flex items-center justify-center gap-1'>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleForceSubmit(employee)}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Force Submit</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-8 w-8" disabled={employee.id === user?.uid}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                 </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the employee/user document. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeleteUser(employee.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
           </div>
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <div className="fade-in space-y-6">
      <h3 className="text-xl font-semibold text-gray-800">User Management</h3>
      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User &amp; Permission Management</CardTitle>
              <CardDescription>Manage roles and grant menu access for each user.</CardDescription>
            </div>
            {isAdmin && (
                <Button variant="outline" onClick={() => setAddUserModalOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[250px]">User</TableHead>
                    <TableHead className="w-[200px]">Position</TableHead>
                    <TableHead className="w-[150px]">Role</TableHead>
                    {navItems.map(item => (
                      <TableHead key={item.href} className="text-center">{item.label}</TableHead>
                    ))}
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderContent()}
                </TableBody>
              </Table>
            </div>
            {isAdmin && !isLoading && (
                <div className="pt-4 flex justify-end">
                  <Button onClick={handleSavePermissions}>Save Permissions</Button>
                </div>
            )}
          </CardContent>
        </Card>
      <AddUserDialog isOpen={isAddUserModalOpen} onOpenChange={setAddUserModalOpen} onAddUser={handleAddUser} />
    </div>
  );
}
