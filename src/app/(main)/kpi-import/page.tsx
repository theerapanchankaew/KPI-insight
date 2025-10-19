"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileJson, FileSpreadsheet, XCircle, Send } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useKpiData } from '@/context/KpiDataContext';
import { useRouter } from 'next/navigation';

export default function KpiImportPage() {
  const { setPageTitle } = useAppLayout();
  const { setKpiData } = useKpiData();
  const router = useRouter();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [fileContent, setFileContent] = useState<any | null>(null);

  useEffect(() => {
    setPageTitle('Import KPIs');
  }, [setPageTitle]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && (file.type === 'application/json' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx'))) {
      setFiles([file]);
      setUploadComplete(false);

      if (file.type === 'application/json') {
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
        // Placeholder for Excel file processing
        setFileContent({ message: "Excel file selected, processing not yet implemented."});
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please upload a valid JSON or Excel (.xlsx) file.',
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  const handleUpload = () => {
    if (files.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No File Selected',
        description: 'Please select a file to import.',
      });
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
          toast({
            title: 'Upload Successful',
            description: `${files[0].name} has been imported and is ready to be processed.`,
          });
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleSendToCascade = () => {
    if (fileContent) {
      setKpiData(fileContent);
      toast({
          title: 'Data Sent',
          description: 'KPI data has been sent to the Cascade page.',
      });
      router.push('/cascade');
    } else {
      toast({
        variant: 'destructive',
        title: 'No Data to Send',
        description: 'File content is not available.',
      });
    }
  }

  const removeFile = () => {
    setFiles([]);
    setUploadComplete(false);
    setFileContent(null);
  };

  const exampleJson = `{
  "version": "1.0",
  "exported_at": "2025-10-17T22:39:54.121683Z",
  "organization": "Management System Certification Institute (Thailand), Foundation (MASCI)",
  "fiscal_year": {
    "thailand_buddhist_year": 2569,
    "gregorian_label": "FY2026"
  },
  "kpi_catalog": [
    {
      "id": "1bf13fca-25c4-4a04-8390-8b2173a2ffda",
      "perspective": "Sustainability",
      "strategic_objective": "Grow Corporate Value",
      "objective_statement": "การเติบโตอย่างยั่งยืน...",
      "measure": "Total Revenue",
      "target": "≥ 194.10 ล้านบาท",
      "unit": "THB million",
      "target_statement": "รายรับรวมของสถาบันฯ...",
      "category": "Theme:Sustainability Excellence"
    }
  ]
}`;

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800">Import KPI Data</h3>
        <p className="text-gray-600 mt-1">นำเข้าข้อมูล KPI จากไฟล์ JSON หรือ Excel</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>Select a JSON or Excel file containing your KPI data to begin the import process.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary/50'}`}>
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
            {isDragActive ? (
              <p className="mt-2 font-semibold text-primary">Drop the file here...</p>
            ) : (
              <p className="mt-2 text-sm text-gray-600">Drag & drop a file here, or click to select a file</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Supported formats: JSON, Excel (.xlsx)</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800">Selected File:</h4>
              {files.map(file => (
                <div key={file.name} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {file.type === 'application/json' ? <FileJson className="h-6 w-6 text-secondary" /> : <FileSpreadsheet className="h-6 w-6 text-success" />}
                    <span className="font-medium text-sm">{file.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removeFile} disabled={uploading}>
                    <XCircle className="h-5 w-5 text-gray-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {uploading && (
             <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-sm text-center text-gray-600">{uploadProgress}% uploaded</p>
             </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button onClick={handleUpload} disabled={files.length === 0 || uploading || uploadComplete}>
              {uploading ? 'Importing...' : 'Import KPIs'}
            </Button>
            {uploadComplete && (
                <Button onClick={handleSendToCascade} variant="secondary">
                    <Send className="w-4 h-4 mr-2" />
                    Send to Cascade
                </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Example JSON Structure</CardTitle>
          <CardDescription>Ensure your JSON file follows this structure for a successful import.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto">
            <code>
              {exampleJson}
            </code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
