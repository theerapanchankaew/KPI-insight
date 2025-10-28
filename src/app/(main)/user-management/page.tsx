
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { navItems } from '@/lib/data/layout-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useCollection, useFirestore, useMemoFirebase, useUser, WithId } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';
import { useKpiData, type Employee } from '@/context/KpiDataContext';

type Role = 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee';

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  department: string;
  position: string;
  manager: string;
  role: Role;
  menuAccess: { [key: string]: boolean };
}

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
    '/reports': false,
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
  const { orgData, isOrgDataLoading } = useKpiData();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
        if (user) {
            try {
                const idTokenResult = await user.getIdTokenResult();
                setIsAdmin(idTokenResult.claims.role === 'Admin');
            } catch (error) {
                console.error("Error fetching user claims:", error);
                setIsAdmin(false);
            }
        } else if (!isAuthLoading) {
           setIsAdmin(false);
        }
    };
    checkAdminStatus();
  }, [user, isAuthLoading]);

  useEffect(() => {
    setPageTitle('User Management');
  }, [setPageTitle]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdmin]);
  
  const { data: usersData, isLoading: isUsersLoading, error } = useCollection<AppUser>(usersQuery);

  const [managedUsers, setManagedUsers] = useState<WithId<ManagedUser>[]>([]);
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);

  useEffect(() => {
    const allKnownUsers = new Map<string, WithId<ManagedUser>>();

    // First, process employees from orgData
    if (orgData) {
        orgData.forEach(employee => {
            allKnownUsers.set(employee.id, {
                ...employee,
                role: 'Employee', // Default role
                menuAccess: defaultPermissions.Employee
            });
        });
    }

    // Then, merge or add users from usersData (authentication records)
    if (usersData) {
        usersData.forEach(userProfile => {
            const existing = allKnownUsers.get(userProfile.id);
            if (existing) {
                // Merge if user exists in both collections
                allKnownUsers.set(userProfile.id, { ...existing, ...userProfile });
            } else {
                // Add if user exists in auth but not as an employee record
                allKnownUsers.set(userProfile.id, {
                    id: userProfile.id,
                    name: userProfile.name || 'N/A',
                    department: userProfile.department || 'Unassigned',
                    position: userProfile.position || 'N/A',
                    manager: userProfile.manager || '',
                    ...userProfile
                });
            }
        });
    }

    setManagedUsers(Array.from(allKnownUsers.values()));
  }, [orgData, usersData]);
  
  const handleRoleChange = (userId: string, role: Role) => {
    setManagedUsers(prev => prev.map(user => 
      user.id === userId 
      ? { ...user, role, menuAccess: defaultPermissions[role] }
      : user
    ));
  };

  const handlePermissionChange = (userId: string, menuHref: string, checked: boolean) => {
    setManagedUsers(prev => prev.map(user => 
        user.id === userId
        ? { ...user, menuAccess: { ...user.menuAccess, [menuHref]: checked } }
        : user
    ));
  };

  const handleSavePermissions = () => {
    if (!firestore) {
        toast({ title: 'Error', description: 'Firestore is not available.', variant: 'destructive'});
        return;
    }
    if (!isAdmin) {
        toast({ title: 'Permission Denied', description: 'Only admins can save permissions.', variant: 'destructive'});
        return;
    }

    let usersUpdated = 0;
    managedUsers.forEach(user => {
      // Only save users that have a proper user profile (i.e., they exist in the 'users' collection)
      if (usersData?.some(u => u.id === user.id)) {
        const userRef = doc(firestore, 'users', user.id);
        const userDataToSave = {
            role: user.role,
            menuAccess: user.menuAccess,
        };
        setDocumentNonBlocking(userRef, userDataToSave, { merge: true });
        usersUpdated++;
      }
    });
    toast({
        title: "User Permissions Saved",
        description: `Permissions for ${usersUpdated} user(s) have been updated in Firestore.`,
    });
  };

  const handleAddUser = (newUser: Omit<Employee, 'id'>) => {
    if (!firestore) {
        toast({ title: 'Error', description: 'Firestore is not available.', variant: 'destructive'});
        return;
    }
    if (!isAdmin) {
        toast({ title: 'Permission Denied', description: 'Only admins can add employees.', variant: 'destructive'});
        return;
    }
    const employeesCollection = collection(firestore, 'employees');
    // Using a simple ID based on name for this example. In a real app, a better unique ID is needed.
    const newId = newUser.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-5);
    addDocumentNonBlocking(doc(employeesCollection, newId), {id: newId, ...newUser});
    
    toast({ title: 'Employee Added', description: `${newUser.name} has been added to the organization.` });
  };

  const handleDeleteUser = (employeeId: string) => {
      if (!firestore) {
        toast({ title: 'Error', description: 'Firestore is not available.', variant: 'destructive'});
        return;
      }
      if (!isAdmin) {
        toast({ title: 'Permission Denied', description: 'Only admins can delete users.', variant: 'destructive'});
        return;
      }
      const employeeRef = doc(firestore, 'employees', employeeId);
      deleteDocumentNonBlocking(employeeRef);

      // Also attempt to delete the corresponding user doc if it exists
      const userProfile = usersData?.find(u => u.id === employeeId);
      if(userProfile) {
        const userRef = doc(firestore, 'users', userProfile.id);
        deleteDocumentNonBlocking(userRef);
      }

      toast({ title: 'User Removed', description: 'The user has been removed from the organization list.', variant: 'destructive' });
  };

  const isLoading = isAuthLoading || isUsersLoading || isOrgDataLoading || isAdmin === null;

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
                    You do not have the necessary permissions to view this page. Please contact your system administrator if you believe this is an error.
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
                    Could not load user permissions data. {error.message}
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
                    No users found. Add an employee or have users sign up.
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
                  This will permanently delete the employee/user document. This action cannot be undone.
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
            {isAdmin && (
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

    