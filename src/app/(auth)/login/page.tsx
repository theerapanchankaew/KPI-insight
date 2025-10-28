
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth, useFirestore, useUser, initiateEmailSignIn } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { navItems } from '@/lib/data/layout-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SignInForm = () => {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const handleEmailSignIn = (e: React.FormEvent) => {
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
    initiateEmailSignIn(auth, email, password);
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
            />
          </div>
           {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full">
              <LogIn className="mr-2 h-4 w-4"/>
              Sign In
          </Button>
        </CardFooter>
      </form>
  )
}

const SignUpForm = () => {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  
  const positions = ["เจ้าหน้าที่บริหารงานคุณภาพ", "ผู้จัดการแผนกอาวุโส", "ผู้จัดการฝ่าย", "ผู้ช่วยผู้จัดการฝ่าย", "พนักงาน"];
  const departments = ["HQMS", "QMS", "Sales", "Operations", "Corporate Affairs"];


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
    if (!position) {
        setError("Please select a position.");
        return;
    }
    if (!department) {
        setError("Please select a department.");
        return;
    }
    setError(null);
    setIsSigningUp(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName });
      
      const userRef = doc(firestore, 'users', user.uid);
      const userRole = email.includes('admin') || email.includes('theerapan@masci') ? 'Admin' : 'Employee';
      
      // Default permissions for the new user's role
      const defaultPermissions: { [key: string]: boolean } = navItems.reduce((acc, item) => {
        let hasAccess = false;
        if (userRole === 'Admin') {
            hasAccess = true;
        } else if (userRole === 'Employee') {
            hasAccess = ['/dashboard', '/portfolio', '/submit', '/reports'].includes(item.href);
        } else { // Managerial roles
            hasAccess = !['/kpi-import', '/user-management'].includes(item.href);
        }
        acc[item.href] = hasAccess;
        return acc;
      }, {} as { [key: string]: boolean });


      const newUserProfile = {
        id: user.uid,
        name: displayName,
        email: email,
        role: userRole,
        department: department,
        position: position,
        manager: '',
        menuAccess: defaultPermissions,
      };
      
      // Save user profile to Firestore
      setDocumentNonBlocking(userRef, newUserProfile, { merge: true });
      
      toast({
          title: "Account Created",
          description: "Your account has been successfully created."
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
          <Label htmlFor="displayName">Display Name</Label>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required disabled={isSigningUp} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSigningUp}/>
        </div>
        <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select value={department} onValueChange={setDepartment} required disabled={isSigningUp}>
                <SelectTrigger id="department">
                    <SelectValue placeholder="Select your department" />
                </SelectTrigger>
                <SelectContent>
                    {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Select value={position} onValueChange={setPosition} required disabled={isSigningUp}>
                <SelectTrigger id="position">
                    <SelectValue placeholder="Select your position" />
                </SelectTrigger>
                <SelectContent>
                    {positions.map((pos) => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isSigningUp} />
        </div>
         <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isSigningUp} />
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
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
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
