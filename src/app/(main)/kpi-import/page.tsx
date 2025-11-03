
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileJson, XCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { exampleJson, exampleOrgData } from '@/lib/data/kpi-import-data';

const KpiImportTab = () => {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [fileContent, setFileContent] = useState<{ kpi_catalog: any[] } | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
            setFiles([file]);
            setUploadComplete(false);

            const reader = new FileReader();
            reader.onabort = () => console.log('file reading was aborted');
            reader.onerror = () => console.log('file reading has failed');
            reader.onload = () => {
                try {
                    const binaryStr = reader.result;
                    if (typeof binaryStr === 'string') {
                        const parsedJson = JSON.parse(binaryStr);
                        if (parsedJson && Array.isArray(parsedJson.kpi_catalog)) {
                            setFileContent(parsedJson);
                        } else {
                            throw new Error("Invalid JSON structure. Missing 'kpi_catalog' array.");
                        }
                    }
                } catch (error: any) {
                    toast({
                        variant: 'destructive',
                        title: 'Invalid JSON',
                        description: error.message || 'Could not parse the JSON file.',
                    });
                    setFileContent(null);
                }
            };
            reader.readAsText(file);
        } else {
            toast({
                variant: 'destructive',
                title: 'Invalid File Type',
                description: 'Please upload a valid JSON file.',
            });
        }
    }, [toast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        accept: { 'application/json': ['.json'] }
    });

    const handleUpload = async () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore not initialized.' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to import data.' });
            return;
        }
        if (files.length === 0 || !fileContent) {
            toast({ variant: 'destructive', title: 'No File Selected', description: 'Please select a file to import.' });
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        
        const kpisToUpload = fileContent.kpi_catalog;
        const totalKpis = kpisToUpload.length;
        
        try {
            const batch = writeBatch(firestore);
            kpisToUpload.forEach((kpi, index) => {
                const docRef = doc(firestore, 'kpi_catalog', kpi.id);
                batch.set(docRef, kpi, { merge: true });
            });

            await batch.commit();

            setUploadProgress(100);
            setUploading(false);
            setUploadComplete(true);
            toast({ title: 'Upload Complete', description: `${totalKpis} KPIs have been saved to Firestore.` });
            router.push('/cascade');
        } catch (error) {
            console.error(error);
            setUploading(false);
            toast({ title: 'Upload Failed', description: 'Could not save KPIs to Firestore.', variant: 'destructive'});
        }
    };

    const removeFile = () => {
        setFiles([]);
        setUploadComplete(false);
        setFileContent(null);
    };

    const isButtonDisabled = files.length === 0 || uploading || uploadComplete || !fileContent || !user || isUserLoading;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload KPI File</CardTitle>
                    <CardDescription>Select a JSON file with your KPI data catalog.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary/50'}`}>
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-600">Drag & drop a JSON file here, or click to select</p>
                    </div>

                    {files.length > 0 && (
                        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <FileJson className="h-6 w-6 text-secondary" />
                                <span className="font-medium text-sm">{files[0].name}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={removeFile} disabled={uploading}><XCircle className="h-5 w-5 text-gray-500" /></Button>
                        </div>
                    )}

                    {uploading && <Progress value={uploadProgress} />}

                    <div className="flex justify-end items-center space-x-4">
                        {!user && !isUserLoading && (
                            <p className="text-sm text-destructive">Please log in to import data.</p>
                        )}
                        <Button onClick={handleUpload} disabled={isButtonDisabled}>
                            {isUserLoading ? 'Authenticating...' : uploading ? 'Importing...' : 'Import to Firestore'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Example KPI JSON Structure</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto"><code>{exampleJson}</code></pre>
                </CardContent>
            </Card>
        </div>
    );
}

const OrgImportTab = () => {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [files, setFiles] = useState<File[]>([]);
    const [fileContent, setFileContent] = useState<any[] | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
            setFiles([file]);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result;
                    if (typeof text === 'string') {
                        const parsedJson = JSON.parse(text);
                        if(Array.isArray(parsedJson)) {
                           setFileContent(parsedJson);
                           toast({ title: 'File Ready', description: `${file.name} is ready to be imported.` });
                        } else {
                           throw new Error("JSON data is not an array.");
                        }
                    }
                } catch (error: any) {
                    toast({ variant: 'destructive', title: 'Invalid JSON', description: error.message || 'Could not parse the JSON file.' });
                }
            };
            reader.readAsText(file);
        } else {
            toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a JSON file.' });
        }
    }, [toast]);
    
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, accept: { 'application/json': ['.json'] } });

    const handleProcessAndSend = () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore not initialized.' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to import data.' });
            return;
        }
        if (fileContent) {
            const batch = writeBatch(firestore);
            fileContent.forEach((item: any) => {
                const employeeId = String(item.id);
                if (!employeeId) return;

                const employeeDocRef = doc(firestore, 'employees', employeeId);
                const employeeData = {
                    id: employeeId,
                    name: item.name || 'N/A',
                    department: item.department || 'N/A',
                    position: item.position || 'N/A',
                    manager: item.manager || ''
                };
                batch.set(employeeDocRef, employeeData, { merge: true });
            });
            
            batch.commit().then(() => {
                toast({ title: 'Import Complete', description: 'Organization data has been saved to the "employees" collection.' });
                router.push('/user-management');
            }).catch(error => {
                console.error("Error writing batch: ", error);
                toast({ variant: 'destructive', title: 'Import Failed', description: 'Could not save organization data.' });
            });

        } else {
             toast({ variant: 'destructive', title: 'No Data to Send', description: 'No file has been processed.' });
        }
    };
    
    const removeFile = () => {
        setFiles([]);
        setFileContent(null);
    };

    const isButtonDisabled = !fileContent || !user || isUserLoading;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload Organization Data</CardTitle>
                    <CardDescription>Select a JSON file with employee and organization structure. This will create or update records in the 'employees' collection.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary/50'}`}>
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-600">Drag & drop a JSON file here, or click to select</p>
                    </div>
                     {files.length > 0 && (
                        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <FileJson className="h-6 w-6 text-success" />
                                <span className="font-medium text-sm">{files[0].name}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={removeFile}><XCircle className="h-5 w-5 text-gray-500" /></Button>
                        </div>
                    )}
                    <div className="flex justify-end items-center space-x-4">
                        {!user && !isUserLoading && (
                            <p className="text-sm text-destructive">Please log in to import data.</p>
                        )}
                        <Button onClick={handleProcessAndSend} disabled={isButtonDisabled} variant="secondary">
                            {isUserLoading ? 'Authenticating...' : 'Import to Firestore'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Example Organization JSON Structure</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto"><code>{exampleOrgData}</code></pre>
                </CardContent>
            </Card>
        </div>
    )
}


export default function KpiImportPage() {
  const { setPageTitle } = useAppLayout();

  useEffect(() => {
    setPageTitle('Intake Data');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800">Intake Data</h3>
        <p className="text-gray-600 mt-1">นำเข้าข้อมูล KPI, โครงสร้างองค์กร และข้อมูลพนักงาน</p>
      </div>
      <Tabs defaultValue="kpi" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="kpi">KPI Data</TabsTrigger>
          <TabsTrigger value="org">Organization Data</TabsTrigger>
        </TabsList>
        <TabsContent value="kpi" className="mt-6">
          <KpiImportTab />
        </TabsContent>
        <TabsContent value="org" className="mt-6">
          <OrgImportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
