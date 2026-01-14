"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

// Database configurations
const DB_TYPES = [
    { id: "postgresql", name: "PostgreSQL", icon: "🐘", color: "border-blue-300 bg-blue-50", description: "Powerful SQL database" },
    { id: "mysql", name: "MySQL", icon: "🐬", color: "border-orange-300 bg-orange-50", description: "Popular relational DB" },
    { id: "mongodb", name: "MongoDB", icon: "🍃", color: "border-green-300 bg-green-50", description: "Document database" },
    { id: "redis", name: "Redis", icon: "⚡", color: "border-red-300 bg-red-50", description: "In-memory cache" },
];

const PROGRESS_STEPS = [
    { id: "pull", label: "Pulling image" },
    { id: "volume", label: "Creating volume" },
    { id: "start", label: "Starting container" },
    { id: "health", label: "Health check" },
    { id: "ready", label: "Ready" },
];

export default function NewDatabasePage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Form state
    const [serverId, setServerId] = useState("");
    const [dbType, setDbType] = useState<string>("");
    const [dbName, setDbName] = useState("");
    const [exposure, setExposure] = useState<"internal" | "public">("internal");

    // Progress state
    const [isCreating, setIsCreating] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [createdDbId, setCreatedDbId] = useState<string | null>(null);

    // Get servers
    const { data: servers = [] } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    const connectedServers = servers.filter(s =>
        s.status.toLowerCase() === "connected"
    );

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            return api.createDatabase(serverId, {
                name: dbName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                type: dbType as "postgresql" | "mysql" | "mongodb" | "redis",
                exposure,
            });
        },
        onSuccess: (data) => {
            setCreatedDbId(data.id);
            // Simulate progress steps
            simulateProgress();
        },
        onError: (err: Error) => {
            setError(err.message);
            setIsCreating(false);
        },
    });

    const simulateProgress = async () => {
        // Poll for database status
        for (let step = 0; step < PROGRESS_STEPS.length; step++) {
            setCurrentStep(step);
            await new Promise(r => setTimeout(r, 1500));

            // Check if database is ready
            if (createdDbId) {
                try {
                    const db = await api.getDatabase(serverId, createdDbId);
                    if (db.status.toLowerCase() === "running") {
                        setCurrentStep(PROGRESS_STEPS.length - 1);
                        break;
                    } else if (db.status.toLowerCase() === "error") {
                        setError("Database creation failed");
                        break;
                    }
                } catch {
                    // Continue polling
                }
            }
        }
        queryClient.invalidateQueries({ queryKey: ["allDatabases"] });
    };

    const handleCreate = async () => {
        if (!serverId || !dbType || !dbName) return;
        setIsCreating(true);
        setError(null);
        setCurrentStep(0);
        createMutation.mutate();
    };

    const isComplete = currentStep === PROGRESS_STEPS.length - 1 && createdDbId;

    return (
        <>
            <Header title="Create Database" description="Deploy a new database instance">
                <Button variant="outline" asChild>
                    <Link href="/databases">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Link>
                </Button>
            </Header>

            <div className="p-6 max-w-2xl mx-auto">
                {!isCreating ? (
                    <div className="space-y-6">
                        {/* Server Selection */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Select Server</CardTitle>
                                <CardDescription>Choose a server to host this database</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {connectedServers.length === 0 ? (
                                    <p className="text-sm text-slate-500">No connected servers available</p>
                                ) : (
                                    <Select value={serverId} onValueChange={setServerId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a server" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {connectedServers.map((server) => (
                                                <SelectItem key={server.id} value={server.id}>
                                                    {server.name} ({server.ip})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </CardContent>
                        </Card>

                        {/* Database Type */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Database Type</CardTitle>
                                <CardDescription>Select the database engine</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-3">
                                    {DB_TYPES.map((db) => (
                                        <button
                                            key={db.id}
                                            type="button"
                                            onClick={() => setDbType(db.id)}
                                            className={`p-4 rounded-lg border-2 text-left transition-all ${dbType === db.id
                                                    ? `${db.color} border-opacity-100 shadow-sm`
                                                    : "border-slate-200 hover:border-slate-300"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{db.icon}</span>
                                                <div>
                                                    <p className="font-medium">{db.name}</p>
                                                    <p className="text-xs text-slate-500">{db.description}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Database Name */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Database Name</CardTitle>
                                <CardDescription>Name for your database (lowercase, no spaces)</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Input
                                    placeholder="my-database"
                                    value={dbName}
                                    onChange={(e) => setDbName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                                />

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Network Exposure</label>
                                    <div className="mt-2 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setExposure("internal")}
                                            className={`flex-1 p-3 rounded-lg border-2 text-left ${exposure === "internal"
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-slate-200"
                                                }`}
                                        >
                                            <p className="font-medium text-sm">Internal</p>
                                            <p className="text-xs text-slate-500">Server only (recommended)</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExposure("public")}
                                            className={`flex-1 p-3 rounded-lg border-2 text-left ${exposure === "public"
                                                    ? "border-orange-500 bg-orange-50"
                                                    : "border-slate-200"
                                                }`}
                                        >
                                            <p className="font-medium text-sm">Public</p>
                                            <p className="text-xs text-slate-500">Internet accessible</p>
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Create Button */}
                        <Button
                            onClick={handleCreate}
                            disabled={!serverId || !dbType || !dbName || createMutation.isPending}
                            className="w-full h-12 text-lg"
                        >
                            <Database className="h-5 w-5 mr-2" />
                            Install Database
                        </Button>
                    </div>
                ) : (
                    /* Progress View */
                    <Card>
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4">
                                {error ? (
                                    <XCircle className="h-16 w-16 text-red-500" />
                                ) : isComplete ? (
                                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                                ) : (
                                    <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
                                )}
                            </div>
                            <CardTitle className="text-xl">
                                {error ? "Installation Failed" : isComplete ? "Database Ready!" : "Installing Database..."}
                            </CardTitle>
                            <CardDescription>
                                {error || `Creating ${dbType} database "${dbName}"`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Progress Steps */}
                            <div className="space-y-3">
                                {PROGRESS_STEPS.map((step, index) => {
                                    const isActive = index === currentStep && !error && !isComplete;
                                    const isDone = index < currentStep || isComplete;
                                    const isError = error && index === currentStep;

                                    return (
                                        <div key={step.id} className="flex items-center gap-3">
                                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-sm ${isDone ? "bg-green-500 text-white" :
                                                    isError ? "bg-red-500 text-white" :
                                                        isActive ? "bg-blue-500 text-white" :
                                                            "bg-slate-200 text-slate-500"
                                                }`}>
                                                {isDone ? "✓" : isError ? "✕" : index + 1}
                                            </div>
                                            <span className={`${isDone || isActive ? "text-slate-900" : "text-slate-400"}`}>
                                                {step.label}
                                            </span>
                                            {isActive && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Actions */}
                            {(isComplete || error) && (
                                <div className="flex gap-3 pt-4">
                                    {isComplete && createdDbId && (
                                        <Button className="flex-1" asChild>
                                            <Link href={`/databases/${createdDbId}?server=${serverId}`}>
                                                View Database
                                            </Link>
                                        </Button>
                                    )}
                                    <Button variant="outline" className="flex-1" asChild>
                                        <Link href="/databases">
                                            {error ? "Back to Databases" : "Done"}
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
