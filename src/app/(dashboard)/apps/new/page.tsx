"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, GitBranch, ArrowLeft, File, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EnvVarsEditor, EnvVar } from "@/components/ui/env-vars-editor";
import { api } from "@/lib/api";

export default function NewAppPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const serverId = searchParams.get("server");

    const [deployType, setDeployType] = useState<"file" | "git">("file");
    const [name, setName] = useState("");
    const [domain, setDomain] = useState("");
    const [envVars, setEnvVars] = useState<EnvVar[]>([]);

    // File upload
    const [files, setFiles] = useState<FileList | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Git
    const [gitUrl, setGitUrl] = useState("");
    const [branch, setBranch] = useState("main");

    const { data: servers = [] } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    const [selectedServerId, setSelectedServerId] = useState(serverId || "");

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!files || files.length === 0) {
                throw new Error("No files selected");
            }

            const file = files[0];

            // Read file as base64
            const fileData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove data URL prefix (e.g., "data:application/zip;base64,")
                    const base64 = result.split(",")[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Convert envVars to object format
            const envVarsObj = envVars.reduce((acc, v) => {
                if (v.key) acc[v.key] = v.value;
                return acc;
            }, {} as Record<string, string>);

            return api.uploadApp(selectedServerId, {
                name,
                domain: domain || undefined,
                filename: file.name,
                fileData,
                envVars: Object.keys(envVarsObj).length > 0 ? envVarsObj : undefined,
            });
        },
        onSuccess: (data) => {
            router.push(`/apps/${data.id}`);
        },
    });

    const gitMutation = useMutation({
        mutationFn: async () => {
            // Convert envVars to object format
            const envVarsObj = envVars.reduce((acc, v) => {
                if (v.key) acc[v.key] = v.value;
                return acc;
            }, {} as Record<string, string>);

            return api.createApp(selectedServerId, {
                name,
                gitUrl,
                branch,
                domain: domain || undefined,
                envVars: Object.keys(envVarsObj).length > 0 ? envVarsObj : undefined,
            });
        },
        onSuccess: (data) => {
            router.push(`/apps/${data.id}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (deployType === "file") {
            uploadMutation.mutate();
        } else {
            gitMutation.mutate();
        }
    };

    const isLoading = uploadMutation.isPending || gitMutation.isPending;
    const error = uploadMutation.error || gitMutation.error;

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            setFiles(e.dataTransfer.files);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
        }
    };

    return (
        <>
            <Header title="Deploy Application" description="Deploy a new app to your server" />

            <div className="p-6 max-w-2xl mx-auto">
                <Button variant="ghost" asChild className="mb-6">
                    <Link href={selectedServerId ? `/servers/${selectedServerId}` : "/apps"}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Link>
                </Button>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Server Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Server</CardTitle>
                            <CardDescription>Select where to deploy</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <select
                                value={selectedServerId}
                                onChange={(e) => setSelectedServerId(e.target.value)}
                                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                required
                            >
                                <option value="">Select a server</option>
                                {servers
                                    .filter((s) => s.status === "CONNECTED" || s.status === "connected")
                                    .map((server) => (
                                        <option key={server.id} value={server.id}>
                                            {server.name} ({server.ip})
                                        </option>
                                    ))}
                            </select>
                        </CardContent>
                    </Card>

                    {/* App Name & Domain */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Application Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="name">App Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="my-app"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="domain">Domain (optional)</Label>
                                <Input
                                    id="domain"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    placeholder="app.example.com"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Point your domain to the server IP before deploying
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Deploy Type */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Deployment Source</CardTitle>
                            <CardDescription>Choose how to deploy your application</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => setDeployType("file")}
                                    className={`p-4 rounded-lg border-2 text-left transition-colors ${deployType === "file"
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-slate-200 hover:border-slate-300"
                                        }`}
                                >
                                    <Upload className="h-6 w-6 mb-2 text-slate-600" />
                                    <p className="font-medium">Upload Files</p>
                                    <p className="text-sm text-slate-500">
                                        Upload your project files directly
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeployType("git")}
                                    className={`p-4 rounded-lg border-2 text-left transition-colors ${deployType === "git"
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-slate-200 hover:border-slate-300"
                                        }`}
                                >
                                    <GitBranch className="h-6 w-6 mb-2 text-slate-600" />
                                    <p className="font-medium">Git Repository</p>
                                    <p className="text-sm text-slate-500">
                                        Deploy from GitHub, GitLab, etc.
                                    </p>
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* File Upload Section */}
                    {deployType === "file" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Upload Files</CardTitle>
                                <CardDescription>
                                    Upload a ZIP file or select multiple files
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-slate-300 transition-colors"
                                >
                                    <Upload className="h-10 w-10 mx-auto mb-4 text-slate-400" />
                                    <p className="text-sm text-slate-600">
                                        Drag & drop files here, or click to browse
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        ZIP, tar.gz, or individual files
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept=".zip,.tar,.tar.gz,.tgz,*"
                                    />
                                </div>

                                {files && files.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-sm font-medium">Selected files:</p>
                                        {Array.from(files).map((file, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between p-2 rounded bg-slate-50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <File className="h-4 w-4 text-slate-400" />
                                                    <span className="text-sm">{file.name}</span>
                                                    <span className="text-xs text-slate-400">
                                                        ({(file.size / 1024).toFixed(1)} KB)
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setFiles(null)}
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Clear
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Git Section */}
                    {deployType === "git" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Git Repository</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="gitUrl">Repository URL</Label>
                                    <Input
                                        id="gitUrl"
                                        value={gitUrl}
                                        onChange={(e) => setGitUrl(e.target.value)}
                                        placeholder="https://github.com/user/repo"
                                        required={deployType === "git"}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="branch">Branch</Label>
                                    <Input
                                        id="branch"
                                        value={branch}
                                        onChange={(e) => setBranch(e.target.value)}
                                        placeholder="main"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Environment Variables */}
                    <EnvVarsEditor
                        envVars={envVars}
                        onChange={setEnvVars}
                    />

                    {/* Error */}
                    {error && (
                        <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm">
                            {(error as Error).message}
                        </div>
                    )}

                    {/* Submit */}
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading || !selectedServerId || !name}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Deploying...
                            </>
                        ) : (
                            "Deploy Application"
                        )}
                    </Button>
                </form>
            </div>
        </>
    );
}
