"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Play, Pause, Trash2, ArrowLeft, Copy, Eye, EyeOff, CheckCircle2, Loader2, Server, Lock, Unlock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { DataBrowser } from "@/components/database/data-browser";


// Database type icons
const DB_ICONS: Record<string, { color: string; icon: string; bgColor: string }> = {
    postgresql: { color: "text-blue-600", icon: "🐘", bgColor: "bg-blue-100" },
    mysql: { color: "text-orange-600", icon: "🐬", bgColor: "bg-orange-100" },
    mongodb: { color: "text-green-600", icon: "🍃", bgColor: "bg-green-100" },
    redis: { color: "text-red-600", icon: "⚡", bgColor: "bg-red-100" },
};

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    creating: { variant: "secondary", label: "Creating..." },
    pending: { variant: "secondary", label: "Pending" },
    running: { variant: "default", label: "Running" },
    stopped: { variant: "outline", label: "Stopped" },
    error: { variant: "destructive", label: "Error" },
};

export default function DatabaseDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryClient = useQueryClient();

    const dbId = params.id as string;
    const serverId = searchParams.get("server") || "";

    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    // Get database details
    const { data: database, isLoading } = useQuery({
        queryKey: ["database", dbId],
        queryFn: () => api.getDatabase(serverId, dbId),
        enabled: !!serverId && !!dbId,
        refetchInterval: 5000, // Refresh every 5s
    });

    // Get password
    const fetchPassword = async () => {
        try {
            const result = await api.getDbPassword(serverId, dbId);
            setPassword(result.password);
            setShowPassword(true);
        } catch {
            setPassword("Error fetching password");
        }
    };

    // Mutations
    const startMutation = useMutation({
        mutationFn: () => api.startDatabase(serverId, dbId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["database", dbId] }),
    });

    const stopMutation = useMutation({
        mutationFn: () => api.stopDatabase(serverId, dbId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["database", dbId] }),
    });

    const deleteMutation = useMutation({
        mutationFn: () => api.deleteDatabase(serverId, dbId),
        onSuccess: () => router.push("/databases"),
    });

    const testMutation = useMutation({
        mutationFn: () => api.testDatabase(serverId, dbId),
    });

    const toggleReadOnlyMutation = useMutation({
        mutationFn: (readOnly: boolean) => api.setDbReadOnly(serverId, dbId, readOnly),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["database", dbId] }),
    });

    const seedMutation = useMutation({
        mutationFn: () => api.seedDatabase(serverId, dbId),
    });

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    if (isLoading || !database) {
        return (
            <>
                <Header
                    title="Database"
                    description="Loading..."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href="/databases">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Link>
                        </Button>
                    }
                />
                <div className="p-6 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            </>
        );
    }

    const dbConfig = DB_ICONS[database.type.toLowerCase()] || DB_ICONS.postgresql;
    const statusConfig = STATUS_BADGES[database.status.toLowerCase()] || STATUS_BADGES.error;
    const isRunning = database.status.toLowerCase() === "running";
    const host = "localhost"; // For local development

    // Connection strings
    const connectionStrings: Record<string, string> = {
        postgresql: `postgresql://${database.username}:${password || "****"}@${host}:${database.hostPort}/${database.name}`,
        mysql: `mysql://${database.username}:${password || "****"}@${host}:${database.hostPort}/${database.name}`,
        mongodb: `mongodb://${database.username}:${password || "****"}@${host}:${database.hostPort}/${database.name}?authSource=admin`,
        redis: `redis://${host}:${database.hostPort}`,
    };
    const connectionString = connectionStrings[database.type.toLowerCase()] || "";

    return (
        <>
            <Header
                title={database.name}
                description={`${database.type} Database`}
                actions={
                    <Button variant="outline" asChild>
                        <Link href="/databases">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Link>
                    </Button>
                }
            />

            <div className="p-6 space-y-6">
                {/* Status Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl ${dbConfig.bgColor}`}>
                                    {dbConfig.icon}
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold">{database.name}</h2>
                                    <p className="text-slate-500 capitalize">{database.type}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={statusConfig.variant} className="text-sm px-3 py-1">
                                    {statusConfig.label}
                                </Badge>
                                {database.readOnly && (
                                    <Badge variant="outline" className="text-sm">
                                        <Lock className="h-3 w-3 mr-1" />
                                        Read-Only
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Connection Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Connection Details</CardTitle>
                        <CardDescription>Use these credentials to connect to your database</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1">
                                <label className="text-sm text-slate-500">Host</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm">{host}</code>
                                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(host, "host")}>
                                        {copied === "host" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm text-slate-500">Port</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm">{database.hostPort || "—"}</code>
                                    {database.hostPort && (
                                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(String(database.hostPort), "port")}>
                                            {copied === "port" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm text-slate-500">Username</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm">{database.username || "—"}</code>
                                    {database.username && (
                                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(database.username!, "username")}>
                                            {copied === "username" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm text-slate-500">Password</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm">
                                        {showPassword && password ? password : "••••••••••••"}
                                    </code>
                                    <Button variant="ghost" size="icon" onClick={() => showPassword ? setShowPassword(false) : fetchPassword()}>
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    {showPassword && password && (
                                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(password, "password")}>
                                            {copied === "password" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Connection String */}
                        <div className="pt-4 border-t">
                            <label className="text-sm text-slate-500">Connection String</label>
                            <div className="flex items-center gap-2 mt-1">
                                <code className="flex-1 bg-slate-900 text-green-400 px-4 py-3 rounded text-sm font-mono overflow-x-auto">
                                    {showPassword ? connectionString : connectionString.replace(password || "****", "****")}
                                </code>
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(connectionString, "conn")}>
                                    {copied === "conn" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Controls */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Controls</CardTitle>
                        <CardDescription>Manage your database instance</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            {isRunning ? (
                                <Button
                                    variant="outline"
                                    onClick={() => stopMutation.mutate()}
                                    disabled={stopMutation.isPending}
                                >
                                    {stopMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pause className="h-4 w-4 mr-2" />}
                                    Stop
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => startMutation.mutate()}
                                    disabled={startMutation.isPending}
                                >
                                    {startMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                    Start
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                onClick={() => testMutation.mutate()}
                                disabled={testMutation.isPending || !isRunning}
                            >
                                {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Test Connection
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => toggleReadOnlyMutation.mutate(!database.readOnly)}
                                disabled={toggleReadOnlyMutation.isPending}
                            >
                                {database.readOnly ? (
                                    <>
                                        <Unlock className="h-4 w-4 mr-2" />
                                        Enable Write
                                    </>
                                ) : (
                                    <>
                                        <Lock className="h-4 w-4 mr-2" />
                                        Set Read-Only
                                    </>
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => seedMutation.mutate()}
                                disabled={seedMutation.isPending || database.readOnly || !isRunning}
                                title={database.readOnly ? "Disable read-only mode first" : "Seed with sample data"}
                            >
                                {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                                Seed Sample Data
                            </Button>

                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (confirm("Are you sure you want to delete this database? All data will be lost.")) {
                                        deleteMutation.mutate();
                                    }
                                }}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Delete
                            </Button>
                        </div>

                        {testMutation.isSuccess && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                                ✓ Connection test successful
                            </div>
                        )}

                        {testMutation.isError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                ✕ Connection test failed
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Resource Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Resources</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <p className="text-sm text-slate-500">CPU Limit</p>
                                <p className="font-medium">{database.cpuLimit || 1.0} cores</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Memory Limit</p>
                                <p className="font-medium">{database.memoryLimit || 512} MB</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Exposure</p>
                                <p className="font-medium capitalize">{database.exposure || "internal"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Data Browser */}
                {isRunning && (
                    <DataBrowser
                        serverId={serverId}
                        dbId={dbId}
                        dbType={database.type.toLowerCase()}
                        dbName={database.name}
                        readOnly={database.readOnly || false}
                    />
                )}
            </div>
        </>
    );
}

