
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { navItems } from '@/lib/data/layout-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<string>('Employee');
  const [error, setError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) {
        setError('Authentication service not available.');
        return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setIsSigningUp(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });
      
      // Create user profile in 'users' collection (for roles and permissions)
      const userRef = doc(firestore, 'users', user.uid);
      const newUserProfile = {
        id: user.uid,
        email: email,
        role: role,
        menuAccess: navItems.reduce((acc, item) => ({...acc, [item.href]: false}), {}),
      };
      setDocumentNonBlocking(userRef, newUserProfile, { merge: true });

      // Create corresponding employee document in 'employees' collection (for organizational data)
      const employeeRef = doc(firestore, 'employees', user.uid);
      const newEmployee = {
        id: user.uid,
        name: name,
        department: 'Unassigned',
        position: 'Unassigned',
        manager: '',
      };
      setDocumentNonBlocking(employeeRef, newEmployee, { merge: true });
      
      toast({
          title: "Account Created",
          description: "Your account has been successfully created. Please sign in."
      });
      // The auth state listener in the layout will handle the redirect.

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
          <Label htmlFor="role">Role (Initial)</Label>
            <Select value={role} onValueChange={setRole} disabled={isSigningUp}>
                <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="VP">VP</SelectItem>
                    <SelectItem value="AVP">AVP</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Employee">Employee</SelectItem>
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This ensures the component has mounted on the client.
    setIsClient(true);
  }, []);

  useEffect(() => {
    // If user is logged in, redirect to dashboard
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);
  
  // Always render the loading screen on the server and initial client render.
  // This guarantees the client and server match, preventing the hydration error.
  if (!isClient || isUserLoading || user) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
           <ShieldCheck className="h-12 w-12 text-primary animate-pulse" />
           <p className="text-muted-foreground">Loading authentication state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
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
    </div>
  );
}
