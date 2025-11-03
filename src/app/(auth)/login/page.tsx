
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth, useFirestore, useUser, useCollection } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, collection, writeBatch, getDocs, limit, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { navItems } from '@/lib/data/layout-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Role, Position } from '@/context/KpiDataContext';


const SignInForm = () => {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
        setError('Authentication service not available.');
        return;
    }
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError(null);
    setIsSigningIn(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Auth listener in layout will handle redirect
    } catch(err: any) {
        setError(err.message);
    } finally {
        setIsSigningIn(false);
    }
  };

  return (
     <form onSubmit={handleEmailSignIn}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSigningIn}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSigningIn}
            />
          </div>
           {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSigningIn}>
            {isSigningIn ? 'Signing In...' : (
              <>
                <LogIn className="mr-2 h-4 w-4"/>
                Sign In
              </>
            )}
          </Button>
        </CardFooter>
      </form>
  )
}

const SignUpForm = () => {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const { data: positions } = useCollection<Position>(firestore ? collection(firestore, 'positions') : null, { disabled: !firestore });
  const { data: roles } = useCollection<Role>(firestore ? collection(firestore, 'roles') : null, { disabled: !firestore });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [positionId, setPositionId] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore || !positions || !roles) {
        setError('Core services not available. Please try again later.');
        return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!positionId) {
        setError("Please select a position.");
        return;
    }
    setError(null);
    setIsSigningUp(true);

    try {
      // Check if any user exists to determine if this is the first user
      const usersQuery = query(collection(firestore, "users"), limit(1));
      const usersSnapshot = await getDocs(usersQuery);
      const isFirstUser = usersSnapshot.empty;
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      const selectedPosition = positions.find(p => p.id === positionId);
      if (!selectedPosition) throw new Error("Selected position not found.");
      
      const userRole = isFirstUser ? 'Admin' : 'Employee';
      const userRoleCode = isFirstUser ? 'admin' : 'employee';

      // This part is illustrative. In a real app, you'd call a Cloud Function
      // to set the custom claim, as it cannot be done securely from the client.
      // For this environment, we'll proceed assuming a backend mechanism handles this.
      console.log(`Assigning role '${userRole}' to ${email}. A backend function should set this custom claim.`);

      let menuAccess: { [key: string]: boolean };
      let userRolesArray = [userRoleCode];

      if (isFirstUser) {
        // First user is an admin, grant all menu access
        menuAccess = navItems.reduce((acc, item) => {
          const key = item.href.replace('/', '');
          if(key) acc[key] = true;
          return acc;
        }, {} as { [key: string]: boolean });
        
        const adminRole = roles.find(r => r.code === 'admin');
        if (adminRole) {
            userRolesArray = [adminRole.code];
        }

      } else {
        // Subsequent users get roles based on their position
        const defaultRoleTemplates = roles.filter(r => selectedPosition.defaultRoles.includes(r.code) || r.code === 'employee');
        menuAccess = defaultRoleTemplates.reduce((acc, role) => ({...acc, ...role.menuAccess}), {});
        userRolesArray = defaultRoleTemplates.map(r => r.code);
      }
      
      const batch = writeBatch(firestore);

      // Create 'users' document (Authorization data)
      const userRef = doc(firestore, 'users', user.uid);
      const newUserProfile = {
        id: user.uid,
        employeeId: user.uid, // Link to the employees collection
        email: email,
        roles: userRolesArray,
        menuAccess: menuAccess,
      };
      batch.set(userRef, newUserProfile);

      // Create 'employees' document (HR Master data)
      const employeeRef = doc(firestore, 'employees', user.uid);
      const newEmployee = {
        id: user.uid,
        name: name,
        email: email,
        departmentId: '', // To be assigned by admin
        positionId: positionId,
        managerId: '', // To be assigned by admin
        level: selectedPosition.level,
        status: 'active',
      };
      batch.set(employeeRef, newEmployee);

      await batch.commit();
      
      toast({
          title: "Account Created",
          description: `Your account has been created with the role: ${userRole}. Please sign in.`
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
        setIsSigningUp(false);
    }
  };

  return (
    <form onSubmit={handleSignUp}>
      <CardContent className="space-y-4">
         <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSigningUp} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSigningUp}/>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isSigningUp} />
        </div>
         <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isSigningUp} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Position</Label>
            <Select value={positionId} onValueChange={setPositionId} disabled={isSigningUp || !positions}>
                <SelectTrigger id="role">
                    <SelectValue placeholder="Select a position" />
                </SelectTrigger>
                <SelectContent>
                    {positions?.map(pos => (
                        <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter>
        <Button type="submit" className="w-full" disabled={isSigningUp}>
          {isSigningUp ? 'Creating Account...' : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </>
          )}
        </Button>
      </CardFooter>
    </form>
  )
}


export default function LoginPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);
  
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
       {isUserLoading || user ? (
           <div className="flex flex-col items-center space-y-4">
             <ShieldCheck className="h-12 w-12 text-primary animate-pulse" />
             <p className="text-muted-foreground">Loading authentication state...</p>
           </div>
        ) : (
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
              <CardTitle className="mt-4 text-2xl">KPI Insights Login</CardTitle>
              <CardDescription>Welcome! Please sign in or create an account.</CardDescription>
            </CardHeader>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <SignInForm />
              </TabsContent>
              <TabsContent value="signup">
                <SignUpForm />
              </TabsContent>
            </Tabs>
          </Card>
        )}
    </div>
  );
}

    