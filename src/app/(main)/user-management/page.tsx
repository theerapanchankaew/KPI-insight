
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useUser, useFirestore, addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useKpiData } from '@/context/KpiDataContext';
import type { Employee, User, Department, Position, Role } from '@/context/KpiDataContext';

type ManagedUser = Employee & {
  userRoles?: string[];
  userDocId?: string;
};

const AddUserDialog = ({ isOpen, onOpenChange, onAddUser, departments, positions }: { 
    isOpen: boolean; 
    onOpenChange: (isOpen: boolean) => void; 
    onAddUser: (user: Partial<Omit<Employee, 'id'>>) => void;
    departments: Department[];
    positions: Position[];
}) => {
    const [newUser, setNewUser] = useState({ name: '', email: '', departmentId: '', positionId: '' });

    const handleAdd = () => {
        if (newUser.name && newUser.email && newUser.departmentId && newUser.positionId) {
            onAddUser(newUser);
            onOpenChange(false);
            setNewUser({ name: '', email: '', departmentId: '', positionId: '' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Employee</DialogTitle>
                    <DialogDescription>
                        This will create an employee document. An admin must later create a corresponding user account for login access.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Full Name" />
                    </div>
                     <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="employee@company.com" />
                    </div>
                    <div className="space-y-2">
                        <Label>Department</Label>
                        <Select value={newUser.departmentId} onValueChange={val => setNewUser({...newUser, departmentId: val})}>
                            <SelectTrigger><SelectValue placeholder="Select Department"/></SelectTrigger>
                            <SelectContent>
                                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Position</Label>
                         <Select value={newUser.positionId} onValueChange={val => setNewUser({...newUser, positionId: val})}>
                            <SelectTrigger><SelectValue placeholder="Select Position"/></SelectTrigger>
                            <SelectContent>
                                {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
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
  const { user: authUser, isUserLoading: isAuthLoading } = useUser();

  // Fetch all users - secure because it's only enabled for admins.
  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);

  const {
      employees, isEmployeesLoading,
      departments, isDepartmentsLoading,
      positions, isPositionsLoading,
      roles, isRolesLoading,
  } = useKpiData();
  
  const currentUserDocRef = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);
  const { data: currentUser, isLoading: isCurrentUserLoading } = useDoc<User>(currentUserDocRef);

  const isAdmin = useMemo(() => currentUser?.roles?.includes('admin'), [currentUser]);

  useEffect(() => {
    setPageTitle('User Management');
  }, [setPageTitle]);


  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);

  useEffect(() => {
    if (isEmployeesLoading || isUsersLoading) return;
    if (!employees) {
        setManagedUsers([]);
        return;
    };

    const usersMap = new Map<string, User>();
    if (users) {
        users.forEach(user => usersMap.set(user.employeeId, user));
    }

    const merged: ManagedUser[] = employees.map(employee => {
        const userAccount = usersMap.get(employee.id);
        return {
            ...employee,
            userRoles: userAccount?.roles || [],
            userDocId: userAccount?.id,
        };
    });
    setManagedUsers(merged);

  }, [employees, users, isEmployeesLoading, isUsersLoading]);
  
  const handleRoleChange = (employeeId: string, newRoles: string[]) => {
    setManagedUsers(prev => prev.map(user => 
      user.id === employeeId 
      ? { ...user, userRoles: newRoles }
      : user
    ));
  };
  
  const handleSaveUser = (employeeId: string) => {
    if (!firestore || !isAdmin) {
        toast({ title: 'Permission Denied', variant: 'destructive'});
        return;
    }

    const managedUser = managedUsers.find(u => u.id === employeeId);
    if (!managedUser || !managedUser.userDocId) {
        toast({ title: "No Login Account", description: "This employee does not have a login account. Cannot save roles.", variant: 'destructive'});
        return;
    }
    
    const userRef = doc(firestore, 'users', managedUser.userDocId);
    const roleTemplates = roles?.filter(r => managedUser.userRoles?.includes(r.code)) || [];
    const menuAccess = roleTemplates.reduce((acc, role) => ({...acc, ...role.menuAccess}), {});
    
    setDocumentNonBlocking(userRef, { 
        roles: managedUser.userRoles,
        menuAccess: menuAccess
    }, { merge: true });

    toast({
        title: "User Saved",
        description: `Roles for ${managedUser.name} have been updated.`,
    });
  };

  const handleAddUser = (newEmployeeData: Partial<Omit<Employee, 'id'>>) => {
    if (!firestore || !isAdmin) {
        toast({ title: 'Permission Denied', variant: 'destructive'});
        return;
    }
    const id = newEmployeeData.email!.replace(/[@.]/g, '_') + `_${Date.now()}`;
    const employeeRef = doc(firestore, 'employees', id);
    setDocumentNonBlocking(employeeRef, {id, ...newEmployeeData, status: 'active'}, { merge: true });
    
    toast({ title: 'Employee Added', description: `${newEmployeeData.name} has been added.` });
  };

  const handleDeleteUser = (employeeId: string) => {
      if (!firestore || !isAdmin) {
        toast({ title: 'Permission Denied', variant: 'destructive'});
        return;
      }
      
      const userToDelete = users?.find(u => u.employeeId === employeeId);

      const employeeRef = doc(firestore, 'employees', employeeId);
      deleteDocumentNonBlocking(employeeRef);

      if (userToDelete) {
        const userRef = doc(firestore, 'users', userToDelete.id);
        deleteDocumentNonBlocking(userRef);
      }

      toast({ title: 'User Removed', description: 'The employee record and any associated user account have been removed.', variant: 'destructive' });
  };

  const isLoading = isAuthLoading || isEmployeesLoading || isUsersLoading || isDepartmentsLoading || isPositionsLoading || isRolesLoading || isCurrentUserLoading;
  
  const getDepartmentName = (id: string) => departments?.find(d => d.id === id)?.name || 'N/A';
  const getPositionName = (id: string) => positions?.find(p => p.id === id)?.name || 'N/A';

  const renderContent = () => {
    if (isLoading) {
       return (
         <TableRow>
            <TableCell colSpan={5} className="h-96">
               <div className="flex items-center justify-center">
                 <p className="text-muted-foreground">Loading user data...</p>
               </div>
            </TableCell>
         </TableRow>
       )
    }

    if (!isAdmin) {
       return (
         <TableRow>
            <TableCell colSpan={5} className="h-96">
               <div className="flex flex-col items-center justify-center text-center">
                 <AlertTriangle className="h-10 w-10 text-destructive" />
                 <h3 className="mt-4 text-lg font-semibold">Access Denied</h3>
                 <p className="text-muted-foreground">You do not have permissions to manage users.</p>
               </div>
            </TableCell>
         </TableRow>
       )
    }
    
    if (managedUsers.length === 0) {
        return (
            <TableRow>
                <TableCell colSpan={5} className="h-96 text-center text-muted-foreground">
                    No employees found.
                </TableCell>
            </TableRow>
        );
    }

    return managedUsers.map(employee => (
      <TableRow key={employee.id}>
        <TableCell>
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8"><AvatarFallback>{employee.name.charAt(0)}</AvatarFallback></Avatar>
            <div>
              <p className="font-medium text-sm">{employee.name}</p>
              <p className="text-xs text-muted-foreground">{employee.email}</p>
            </div>
          </div>
        </TableCell>
        <TableCell>{getDepartmentName(employee.departmentId)}</TableCell>
        <TableCell>{getPositionName(employee.positionId)}</TableCell>
        <TableCell>
          <Select
            value={employee.userRoles?.[0] || ''} // Simplified to single role for this UI
            onValueChange={(roleCode) => handleRoleChange(employee.id, [roleCode])}
            disabled={!employee.userDocId}
          >
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="No Role" /></SelectTrigger>
            <SelectContent>
                {roles?.map(r => <SelectItem key={r.id} value={r.code}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-center">
           <div className='flex items-center justify-center gap-1'>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSaveUser(employee.id)} disabled={!employee.userDocId}>
                <Send className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-8 w-8" disabled={employee.id === authUser?.uid}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                 </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the employee and their user account. This cannot be undone.</AlertDialogDescription>
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
              <CardTitle>Employee & Role Management</CardTitle>
              <CardDescription>Manage employee details, roles, and system permissions.</CardDescription>
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
                    <TableHead className="w-[300px]">User</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderContent()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      <AddUserDialog 
        isOpen={isAddUserModalOpen} 
        onOpenChange={setAddUserModalOpen} 
        onAddUser={handleAddUser}
        departments={departments || []}
        positions={positions || []}
      />
    </div>
  );
}
