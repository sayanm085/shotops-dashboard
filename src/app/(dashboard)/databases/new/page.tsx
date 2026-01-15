"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, CheckCircle2, XCircle, ArrowLeft, Plus, X, Zap, Check, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

// Database configurations
const DB_TYPES = [
    {
        id: "postgresql",
        name: "PostgreSQL",
        icon: "🐘",
        color: "border-blue-500 bg-blue-500/10",
        hoverColor: "hover:border-blue-400",
        selectedColor: "border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/30",
        description: "Powerful SQL database",
        defaultName: "postgres",
        features: ["ACID", "JSON", "Full-text search"]
    },
    {
        id: "mysql",
        name: "MySQL",
        icon: "🐬",
        color: "border-orange-500 bg-orange-500/10",
        hoverColor: "hover:border-orange-400",
        selectedColor: "border-orange-500 bg-orange-500/20 ring-2 ring-orange-500/30",
        description: "Popular relational DB",
        defaultName: "mysql",
        features: ["InnoDB", "Replication", "Fast reads"]
    },
    {
        id: "mongodb",
        name: "MongoDB",
        icon: "🍃",
        color: "border-green-500 bg-green-500/10",
        hoverColor: "hover:border-green-400",
        selectedColor: "border-green-500 bg-green-500/20 ring-2 ring-green-500/30",
        description: "Document database",
        defaultName: "mongo",
        features: ["Documents", "Aggregation", "Sharding"]
    },
    {
        id: "redis",
        name: "Redis",
        icon: "⚡",
        color: "border-red-500 bg-red-500/10",
        hoverColor: "hover:border-red-400",
        selectedColor: "border-red-500 bg-red-500/20 ring-2 ring-red-500/30",
        description: "In-memory cache & queue",
        defaultName: "redis",
        features: ["Caching", "Pub/Sub", "Sessions"]
    },
];

interface DatabaseToCreate {
    type: string;
    name: string;
    exposure: "internal" | "public";
    status: "pending" | "creating" | "success" | "error";
    error?: string;
    createdId?: string;
}

export default function NewDatabasePage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Form state
    const [serverId, setServerId] = useState("");
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [databasesToCreate, setDatabasesToCreate] = useState<DatabaseToCreate[]>([]);
    const [isCreating, setIsCreating] = useState(false);

    // Get servers
    const { data: servers = [] } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    const connectedServers = servers.filter(s =>
        s.status.toLowerCase() === "connected"
    );

    // Toggle database type selection
    const toggleDbType = (typeId: string) => {
        if (selectedTypes.includes(typeId)) {
            setSelectedTypes(prev => prev.filter(t => t !== typeId));
            setDatabasesToCreate(prev => prev.filter(d => d.type !== typeId));
        } else {
            setSelectedTypes(prev => [...prev, typeId]);
            const dbType = DB_TYPES.find(d => d.id === typeId);
            if (dbType) {
                setDatabasesToCreate(prev => [...prev, {
                    type: typeId,
                    name: dbType.defaultName,
                    exposure: "internal",
                    status: "pending"
                }]);
            }
        }
    };

    // Update database config
    const updateDatabaseConfig = (type: string, field: keyof DatabaseToCreate, value: string) => {
        setDatabasesToCreate(prev => prev.map(db =>
            db.type === type ? { ...db, [field]: value } : db
        ));
    };

    // Create all databases
    const createAllDatabases = async () => {
        if (!serverId || databasesToCreate.length === 0) return;

        setIsCreating(true);

        for (let i = 0; i < databasesToCreate.length; i++) {
            const db = databasesToCreate[i];

            // Mark as creating
            setDatabasesToCreate(prev => prev.map(d =>
                d.type === db.type ? { ...d, status: "creating" as const } : d
            ));

            try {
                const result = await api.createDatabase(serverId, {
                    name: db.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                    type: db.type as "postgresql" | "mysql" | "mongodb" | "redis",
                    exposure: db.exposure,
                });

                // Mark as success
                setDatabasesToCreate(prev => prev.map(d =>
                    d.type === db.type ? { ...d, status: "success" as const, createdId: result.id } : d
                ));
            } catch (err) {
                // Mark as error
                setDatabasesToCreate(prev => prev.map(d =>
                    d.type === db.type ? { ...d, status: "error" as const, error: (err as Error).message } : d
                ));
            }

            // Small delay between creations
            await new Promise(r => setTimeout(r, 500));
        }

        queryClient.invalidateQueries({ queryKey: ["allDatabases"] });
    };

    const allComplete = databasesToCreate.length > 0 &&
        databasesToCreate.every(db => db.status === "success" || db.status === "error");
    const anySuccess = databasesToCreate.some(db => db.status === "success");

    return (
        <>
            <Header title="Create Databases" description="Deploy database stack for your application">
                <Button variant="outline" asChild>
                    <Link href="/databases">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Link>
                </Button>
            </Header>

            <div className="p-6 max-w-4xl mx-auto">
                <div className="space-y-6">
                    {/* Server Selection */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-900 text-white text-sm font-bold">1</span>
                                Select Target Server
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {connectedServers.length === 0 ? (
                                <div className="text-center py-4 text-slate-500">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                                    <p className="font-medium">No connected servers</p>
                                    <p className="text-sm">Connect a server first to deploy databases</p>
                                </div>
                            ) : (
                                <Select value={serverId} onValueChange={setServerId}>
                                    <SelectTrigger className="max-w-md">
                                        <SelectValue placeholder="Select a server" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {connectedServers.map((server) => (
                                            <SelectItem key={server.id} value={server.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                                    {server.name || server.hostname}
                                                    <span className="text-slate-400">({server.ip})</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </CardContent>
                    </Card>

                    {/* Database Type Selection - Multi Select */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-900 text-white text-sm font-bold">2</span>
                                Select Databases to Install
                            </CardTitle>
                            <CardDescription>
                                Choose one or more database engines for your stack
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {DB_TYPES.map((db) => {
                                    const isSelected = selectedTypes.includes(db.id);
                                    return (
                                        <button
                                            key={db.id}
                                            type="button"
                                            disabled={isCreating}
                                            onClick={() => toggleDbType(db.id)}
                                            className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                                                    ? db.selectedColor
                                                    : `border-slate-200 ${db.hoverColor} hover:shadow-md`
                                                } ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isSelected && (
                                                <div className="absolute -top-2 -right-2 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                                                    <Check className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                            <div className="text-center">
                                                <span className="text-4xl block mb-2">{db.icon}</span>
                                                <p className="font-semibold text-slate-900">{db.name}</p>
                                                <p className="text-xs text-slate-500 mt-1">{db.description}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-3 justify-center">
                                                {db.features.map(f => (
                                                    <span key={f} className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                                                        {f}
                                                    </span>
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedTypes.length > 0 && (
                                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                                    <Badge variant="secondary">{selectedTypes.length} selected</Badge>
                                    <span>•</span>
                                    <span>{selectedTypes.map(t => DB_TYPES.find(d => d.id === t)?.name).join(", ")}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Database Configuration - For selected types */}
                    {databasesToCreate.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-900 text-white text-sm font-bold">3</span>
                                    Configure Each Database
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {databasesToCreate.map((db) => {
                                        const dbType = DB_TYPES.find(d => d.id === db.type);
                                        if (!dbType) return null;

                                        return (
                                            <div
                                                key={db.type}
                                                className={`p-4 rounded-lg border-2 transition-all ${db.status === "success" ? "border-green-500 bg-green-50" :
                                                        db.status === "error" ? "border-red-500 bg-red-50" :
                                                            db.status === "creating" ? "border-blue-500 bg-blue-50" :
                                                                "border-slate-200"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    {/* Icon & Status */}
                                                    <div className="flex items-center gap-3 min-w-[120px]">
                                                        <span className="text-2xl">{dbType.icon}</span>
                                                        <div>
                                                            <p className="font-medium">{dbType.name}</p>
                                                            {db.status === "creating" && (
                                                                <div className="flex items-center gap-1 text-xs text-blue-600">
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                    Installing...
                                                                </div>
                                                            )}
                                                            {db.status === "success" && (
                                                                <div className="flex items-center gap-1 text-xs text-green-600">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    Installed
                                                                </div>
                                                            )}
                                                            {db.status === "error" && (
                                                                <div className="flex items-center gap-1 text-xs text-red-600">
                                                                    <XCircle className="h-3 w-3" />
                                                                    Failed
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Name Input */}
                                                    <div className="flex-1">
                                                        <Input
                                                            placeholder={`${dbType.defaultName}-db`}
                                                            value={db.name}
                                                            disabled={isCreating}
                                                            onChange={(e) => updateDatabaseConfig(
                                                                db.type,
                                                                "name",
                                                                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                                                            )}
                                                            className="h-9"
                                                        />
                                                    </div>

                                                    {/* Exposure Toggle */}
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            disabled={isCreating}
                                                            onClick={() => updateDatabaseConfig(db.type, "exposure", "internal")}
                                                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${db.exposure === "internal"
                                                                    ? "bg-slate-900 text-white"
                                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                                }`}
                                                        >
                                                            Internal
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isCreating}
                                                            onClick={() => updateDatabaseConfig(db.type, "exposure", "public")}
                                                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${db.exposure === "public"
                                                                    ? "bg-orange-500 text-white"
                                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                                }`}
                                                        >
                                                            Public
                                                        </button>
                                                    </div>

                                                    {/* Remove Button */}
                                                    {!isCreating && db.status === "pending" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleDbType(db.type)}
                                                            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>

                                                {db.error && (
                                                    <p className="mt-2 text-sm text-red-600">{db.error}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        {!isCreating && !allComplete && (
                            <Button
                                onClick={createAllDatabases}
                                disabled={!serverId || databasesToCreate.length === 0}
                                className="flex-1 h-12 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            >
                                <Zap className="h-5 w-5 mr-2" />
                                Install {databasesToCreate.length} Database{databasesToCreate.length !== 1 ? 's' : ''}
                            </Button>
                        )}

                        {isCreating && !allComplete && (
                            <Button disabled className="flex-1 h-12 text-lg">
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Installing Databases...
                            </Button>
                        )}

                        {allComplete && (
                            <div className="flex-1 flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-12"
                                    asChild
                                >
                                    <Link href="/databases">
                                        View All Databases
                                    </Link>
                                </Button>
                                {anySuccess && (
                                    <Button
                                        className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600"
                                        onClick={() => {
                                            const successDb = databasesToCreate.find(d => d.status === "success");
                                            if (successDb?.createdId) {
                                                router.push(`/databases/${successDb.createdId}?server=${serverId}`);
                                            }
                                        }}
                                    >
                                        <CheckCircle2 className="h-5 w-5 mr-2" />
                                        Open First Database
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick Stack Templates */}
                    {!isCreating && databasesToCreate.length === 0 && (
                        <Card className="border-dashed">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-slate-500">Quick Stacks</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedTypes(["postgresql", "redis"]);
                                            setDatabasesToCreate([
                                                { type: "postgresql", name: "app-db", exposure: "internal", status: "pending" },
                                                { type: "redis", name: "cache", exposure: "internal", status: "pending" },
                                            ]);
                                        }}
                                    >
                                        🐘 + ⚡ Web App Stack
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedTypes(["mongodb", "redis"]);
                                            setDatabasesToCreate([
                                                { type: "mongodb", name: "data", exposure: "internal", status: "pending" },
                                                { type: "redis", name: "cache", exposure: "internal", status: "pending" },
                                            ]);
                                        }}
                                    >
                                        🍃 + ⚡ NoSQL Stack
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedTypes(["postgresql", "mongodb", "redis"]);
                                            setDatabasesToCreate([
                                                { type: "postgresql", name: "relational", exposure: "internal", status: "pending" },
                                                { type: "mongodb", name: "documents", exposure: "internal", status: "pending" },
                                                { type: "redis", name: "cache", exposure: "internal", status: "pending" },
                                            ]);
                                        }}
                                    >
                                        🐘 + 🍃 + ⚡ Full Stack
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
}
