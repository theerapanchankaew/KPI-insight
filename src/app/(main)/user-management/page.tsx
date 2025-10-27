
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
import { useCollection, useFirestore, useMemoFirebase, useUser, WithId, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';
import { useKpiData, type Employee } from '@/context/KpiDataContext';

type Role = 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee';

interface AppUser {
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

const AddUserDialog = ({ isOpen, onOpenChange, onAddUser }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; onAddUser: (user: Omit<AppUser, 'id' | 'role' | 'menuAccess'>) => void }) => {
    const [newUser, setNewUser] = useState({ name: '', department: '', position: '', manager: '' });

    const handleAdd = () => {
        if (newUser.name && newUser.department && newUser.position) {
            onAddUser(newUser);
            onOpenChange(false);
            setNewUser({ name: '', department: '', position: '', manager: '' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                        This will create a user document in Firestore. To create an actual login, the user must sign up through the login page.
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
                    <Button onClick={handleAdd}>Add User Document</Button>
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

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: currentUserProfile } = useDoc<AppUser>(userDocRef);

  const isAdmin = useMemo(() => currentUserProfile?.role === 'Admin', [currentUserProfile]);

  useEffect(() => {
    setPageTitle('User Management');
  }, [setPageTitle]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null; // Only query if user is admin
    return collection(firestore, 'users');
  }, [firestore, isAdmin]);
  
  const { data: usersData, isLoading: isUsersLoading, error } = useCollection<AppUser>(usersQuery);

  const [managedUsers, setManagedUsers] = useState<WithId<ManagedUser>[]>([]);
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);

  useEffect(() => {
    if (orgData && usersData) {
        const mergedUsers = orgData.map(employee => {
            const userProfile = usersData.find(u => u.email === employee.id || u.name === employee.name || u.id === employee.id);
            return {
                ...employee,
                ...userProfile,
                id: userProfile?.id || employee.id, // Prioritize user ID if available
                role: userProfile?.role || 'Employee',
                menuAccess: userProfile?.menuAccess || defaultPermissions.Employee
            };
        });
        setManagedUsers(mergedUsers);
    } else if (orgData) {
        setManagedUsers(orgData.map(e => ({...e, role: 'Employee', menuAccess: defaultPermissions.Employee })));
    } else {
        setManagedUsers([]);
    }
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
    managedUsers.forEach(user => {
      // Only save users that have a proper user profile (i.e., they exist in the 'users' collection)
      if (usersData?.some(u => u.id === user.id)) {
        const userRef = doc(firestore, 'users', user.id);
        const userDataToSave = {
            role: user.role,
            menuAccess: user.menuAccess,
        };
        setDocumentNonBlocking(userRef, userDataToSave, { merge: true });
      }
    });
    toast({
        title: "User Permissions Saved",
        description: "User roles and menu access have been successfully updated in Firestore.",
    });
  };

  const handleAddUser = (newUser: Omit<AppUser, 'id' | 'role' | 'menuAccess'>) => {
    if (!firestore) {
        toast({ title: 'Error', description: 'Firestore is not available.', variant: 'destructive'});
        return;
    }
    // This adds to 'employees' collection. User must still sign up to create a 'users' entry.
    const employeesCollection = collection(firestore, 'employees');
    addDocumentNonBlocking(employeesCollection, newUser);
    
    toast({ title: 'Employee Added', description: `${newUser.name} has been added to the organization.` });
  };

  const handleDeleteUser = (employeeId: string) => {
      if (!firestore) {
        toast({ title: 'Error', description: 'Firestore is not available.', variant: 'destructive'});
        return;
      }
      // This deletes from the 'employees' collection.
      const employeeRef = doc(firestore, 'employees', employeeId);
      deleteDocumentNonBlocking(employeeRef);

      // Also attempt to delete the corresponding user doc if it exists
      const userProfile = usersData?.find(u => u.id === employeeId || u.name === managedUsers.find(mu => mu.id === employeeId)?.name);
      if(userProfile) {
        const userRef = doc(firestore, 'users', userProfile.id);
        deleteDocumentNonBlocking(userRef);
      }

      toast({ title: 'User Removed', description: 'The user has been removed from the organization list.', variant: 'destructive' });
  };

  const isLoading = isAuthLoading || isUsersLoading || isOrgDataLoading;

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
                  This will permanently delete the user's document from the employees list. It will not delete their login account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDeleteUser(employee.id)}>Delete Document</AlertDialogAction>
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

    