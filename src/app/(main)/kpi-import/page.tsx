"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileJson, XCircle, Send } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useKpiData } from '@/context/KpiDataContext';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const KpiImportTab = () => {
    const { setKpiData } = useKpiData();
    const router = useRouter();
    const { toast } = useToast();
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [fileContent, setFileContent] = useState<any | null>(null);

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
                        setFileContent(parsedJson);
                    }
                } catch (error) {
                    toast({
                        variant: 'destructive',
                        title: 'Invalid JSON',
                        description: 'Could not parse the JSON file.',
                    });
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

    const handleUpload = () => {
        if (files.length === 0 || !fileContent) {
            toast({ variant: 'destructive', title: 'No File Selected', description: 'Please select a file to import.' });
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        setUploadComplete(false);

        const interval = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setUploading(false);
                    setUploadComplete(true);
                    setKpiData(fileContent); // Set data into context
                    toast({ title: 'Upload Successful', description: `${files[0].name} has been imported.` });
                    return 100;
                }
                return prev + 10;
            });
        }, 200);
    };

    const handleSendToCascade = () => {
        if (fileContent) {
            // Data is already set on upload, just navigate
            toast({ title: 'Redirecting', description: 'Navigating to the Cascade page.' });
            router.push('/cascade');
        } else {
            toast({ variant: 'destructive', title: 'No Data to Send', description: 'File content is not available.' });
        }
    }

    const removeFile = () => {
        setFiles([]);
        setUploadComplete(false);
        setFileContent(null);
    };

    const exampleJson = `{
  "version": "1.0",
  "kpi_catalog": [
    {
      "id": "1bf13fca-25c4-4a04-8390-8b2173a2ffda",
      "perspective": "Sustainability",
      "measure": "Total Revenue",
      "target": "≥ 194.10 ล้านบาท"
    }
  ]
}`;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload KPI File</CardTitle>
                    <CardDescription>Select a JSON file with your KPI data.</CardDescription>
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

                    <div className="flex justify-end space-x-2">
                        <Button onClick={handleUpload} disabled={files.length === 0 || uploading || uploadComplete}>Import KPIs</Button>
                        {uploadComplete && <Button onClick={handleSendToCascade} variant="secondary"><Send className="w-4 h-4 mr-2" />Send to Cascade</Button>}
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
    const { setOrgData } = useKpiData();
    const router = useRouter();
    const { toast } = useToast();
    const [files, setFiles] = useState<File[]>([]);
    const [fileContent, setFileContent] = useState<any | null>(null);

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
                        const transformedData = {
                            employees: parsedJson.map((item: any) => ({
                                id: item['รหัส'].toString(),
                                name: item['ชื่อ-นามสกุล'],
                                department: item['แผนก'],
                                position: item['ตำแหน่ง'],
                                manager: item['ผู้บังคับบัญชา']
                            }))
                        };
                        setFileContent(transformedData);
                        setOrgData(transformedData);
                        toast({ title: 'File Processed', description: `${file.name} is ready to be used.` });
                    }
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Invalid JSON', description: 'Could not parse the JSON file.' });
                }
            };
            reader.readAsText(file);
        } else {
            toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a JSON file.' });
        }
    }, [toast, setOrgData]);
    
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, accept: { 'application/json': ['.json'] } });

    const handleProcessAndSend = () => {
        if (fileContent) {
            // Data is already set on drop, just navigate
            toast({ title: 'Redirecting', description: 'Navigating to the Cascade page.' });
            router.push('/cascade');
        } else {
             toast({ variant: 'destructive', title: 'No Data to Send', description: 'No file has been processed.' });
        }
    };
    
    const removeFile = () => {
        setFiles([]);
        setFileContent(null);
    };

    const exampleOrgData = `[
  {
    "รหัส": 1,
    "ชื่อ-นามสกุล": "ชวลิต แก้วน้ำดี",
    "ตำแหน่ง": "ผู้จัดการแผนกอาวุโส",
    "แผนก": "HQMS",
    "ผู้บังคับบัญชา": "ธีระพันธุ์"
  },
  {
    "รหัส": 2,
    "ชื่อ-นามสกุล": "นายปรัชญ์ ชยานุรักษ์",
    "ตำแหน่ง": "เจ้าหน้าที่บริหารงานคุณภาพ",
    "แผนก": "QMS",
    "ผู้บังคับบัญชา": "ชวลิต แก้วน้ำดี"
  }
]`;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload Organization Data</CardTitle>
                    <CardDescription>Select a JSON file with employee and organization structure.</CardDescription>
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
                    <div className="flex justify-end">
                        <Button onClick={handleProcessAndSend} disabled={!fileContent} variant="secondary">
                            <Send className="w-4 h-4 mr-2" />Process and Send to Cascade
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
  const [currentTab, setCurrentTab] = useState("kpi");

  useEffect(() => {
    setPageTitle('Import Data');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800">Import Data</h3>
        <p className="text-gray-600 mt-1">นำเข้าข้อมูล KPI, โครงสร้างองค์กร และข้อมูลพนักงาน</p>
      </div>
      <Tabs defaultValue="kpi" className="w-full" onValueChange={setCurrentTab}>
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
