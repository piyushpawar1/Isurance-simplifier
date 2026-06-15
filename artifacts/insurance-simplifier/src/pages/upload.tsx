import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Layout } from "@/components/layout";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return;
    }
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setProgress(0);

    // Simulate progress while uploading/analyzing
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 500);

    try {
      const formData = new FormData();
      formData.append("pdf", file);
      
      const response = await fetch(`${import.meta.env.BASE_URL}api/policies/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload policy");
      }

      const policy = await response.json();
      setProgress(100);
      clearInterval(progressInterval);
      
      setTimeout(() => {
        setLocation(`/policies/${policy.id}`);
      }, 500);
    } catch (error) {
      clearInterval(progressInterval);
      setIsUploading(false);
      setProgress(0);
      toast({
        title: "Upload failed",
        description: "There was an error analyzing your policy. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pt-8 md:pt-16">
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Understand your insurance. <br/><span className="text-primary">Finally.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Upload your insurance policy PDF. We'll cut through the legal jargon and tell you exactly what's covered, what's not, and how to make a claim.
          </p>
        </div>

        <Card className="w-full shadow-lg border-primary/10 overflow-hidden relative">
          <CardContent className="p-0">
            <div
              className={`p-12 md:p-20 flex flex-col items-center justify-center transition-colors border-2 border-dashed m-4 rounded-xl ${
                isDragging ? "border-primary bg-primary/5" : "border-muted bg-card hover:bg-muted/30"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {!file ? (
                <>
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <UploadCloud className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Drag and drop your PDF here</h3>
                  <p className="text-muted-foreground mb-6">or click to browse your files (Max 10MB)</p>
                  <Button 
                    size="lg" 
                    className="rounded-full px-8"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select PDF File
                  </Button>
                </>
              ) : (
                <div className="w-full max-w-md flex flex-col items-center text-center space-y-6 animate-in zoom-in-95">
                  <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-lg border border-primary/20 w-full">
                    <FileText className="h-10 w-10 text-primary shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    {!isUploading && (
                      <button 
                        onClick={() => setFile(null)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-2"
                        title="Remove file"
                      >
                        <AlertCircle className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {isUploading ? (
                    <div className="w-full space-y-3">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-primary flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing policy...
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2 w-full" />
                      <p className="text-xs text-muted-foreground text-left mt-2">
                        This usually takes about 10-15 seconds. We are reading the fine print so you don't have to.
                      </p>
                    </div>
                  ) : (
                    <Button 
                      size="lg" 
                      className="w-full rounded-full text-lg h-14"
                      onClick={handleUpload}
                    >
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Simplify this Policy
                    </Button>
                  )}
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="application/pdf"
                onChange={handleFileChange}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
