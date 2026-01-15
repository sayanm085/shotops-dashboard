"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Plus, Server, Trash2, ExternalLink, Loader2, AlertTriangle, MoreVertical, StopCircle, PlayCircle, RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, Database as DbType } from "@/lib/api";

// Database type icons
const DB_ICONS: Record<string, { color: string; bgColor: string; icon: string }> = {
    postgresql: { color: "text-blue-600", bgColor: "bg-blue-100", icon: "🐘" },
    mysql: { color: "text-orange-600", bgColor: "bg-orange-100", icon: "🐬" },
    mongodb: { color: "text-green-600", bgColor: "bg-green-100", icon: "🍃" },
    redis: { color: "text-red-600", bgColor: "bg-red-100", icon: "⚡" },
};

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; color: string }> = {
    creating: { variant: "secondary", label: "Creating...", color: "text-amber-500" },
    pending: { variant: "secondary", label: "Pending", color: "text-amber-500" },
    running: { variant: "default", label: "Running", color: "text-emerald-500" },
    stopped: { variant: "outline", label: "Stopped", color: "text-slate-500" },
    error: { variant: "destructive", label: "Error", color: "text-red-500" },
};

export default function DatabasesPage() {
    const queryClient = useQueryClient();
    const [deleteConfirm, setDeleteConfirm] = useState<{ db: DbType; serverId: string } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Get all servers first
    const { data: servers = [] } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    // Get databases from all servers
    const { data: allDatabases = [], isLoading, refetch } = useQuery({
        queryKey: ["allDatabases", servers.map(s => s.id)],
        queryFn: async () => {
            const results: { db: DbType; serverId: string; serverName: string }[] = [];
            for (const server of servers) {
                try {
                    const dbs = await api.getDatabases(server.id);
                    dbs.forEach(db => results.push({ db, serverId: server.id, serverName: server.name }));
                } catch {
                    // Server might not be connected
                }
            }
            return results;
        },
        enabled: servers.length > 0,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async ({ serverId, dbId }: { serverId: string; dbId: string }) => {
            setDeletingId(dbId);
            const response = await fetch(`http://localhost:4000/servers/${serverId}/databases/${dbId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: "Failed to delete database" }));
                throw new Error(error.message || "Failed to delete database");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["allDatabases"] });
            setDeleteConfirm(null);
            setDeletingId(null);
        },
        onError: (error) => {
            console.error("Delete error:", error);
            setDeletingId(null);
        },
    });

    // Stop database mutation
    const [stoppingId, setStoppingId] = useState<string | null>(null);
    const stopMutation = useMutation({
        mutationFn: async ({ serverId, dbId }: { serverId: string; dbId: string }) => {
            setStoppingId(dbId);
            const response = await fetch(`http://localhost:4000/servers/${serverId}/databases/${dbId}/stop`, {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: "Failed to stop database" }));
                throw new Error(error.message || "Failed to stop database");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["allDatabases"] });
            setStoppingId(null);
        },
        onError: (error) => {
            console.error("Stop error:", error);
            setStoppingId(null);
        },
    });

    // Start database mutation
    const [startingId, setStartingId] = useState<string | null>(null);
    const startMutation = useMutation({
        mutationFn: async ({ serverId, dbId }: { serverId: string; dbId: string }) => {
            setStartingId(dbId);
            const response = await fetch(`http://localhost:4000/servers/${serverId}/databases/${dbId}/start`, {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: "Failed to start database" }));
                throw new Error(error.message || "Failed to start database");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["allDatabases"] });
            setStartingId(null);
        },
        onError: (error) => {
            console.error("Start error:", error);
            setStartingId(null);
        },
    });

    const handleDelete = () => {
        if (deleteConfirm) {
            deleteMutation.mutate({ serverId: deleteConfirm.serverId, dbId: deleteConfirm.db.id });
        }
    };

    const hasServers = servers.length > 0;
    const hasDatabases = allDatabases.length > 0;

    return (
        <>
            <Header
                title="Databases"
                description="Manage PostgreSQL, MySQL, MongoDB, and Redis instances"
            />

            <div className="p-6">
                {isLoading ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
                            <p className="mt-4 text-slate-500">Loading databases...</p>
                        </CardContent>
                    </Card>
                ) : !hasServers ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Server className="mx-auto h-12 w-12 text-slate-300" />
                            <h3 className="mt-4 font-medium text-slate-900">No servers connected</h3>
                            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                Connect a server first to create database instances
                            </p>
                            <Button className="mt-4" asChild>
                                <Link href="/servers">Go to Servers</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : !hasDatabases ? (
                    <Card className="border-dashed border-2">
                        <CardContent className="py-16 text-center">
                            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                                <Database className="h-8 w-8 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900">No databases yet</h3>
                            <p className="mx-auto mt-2 max-w-md text-slate-500">
                                Deploy PostgreSQL, MySQL, MongoDB, or Redis with a single click.
                                Create multiple databases at once for your full stack.
                            </p>
                            <Button size="lg" className="mt-6 h-12 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" asChild>
                                <Link href="/databases/new">
                                    <Plus className="h-5 w-5 mr-2" />
                                    Create Your First Database
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {/* Stats & Actions Bar */}
                        <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4 border">
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{allDatabases.length}</p>
                                    <p className="text-sm text-slate-500">Total Databases</p>
                                </div>
                                <div className="h-10 w-px bg-slate-200" />
                                <div>
                                    <p className="text-2xl font-bold text-emerald-600">
                                        {allDatabases.filter(d => d.db.status.toLowerCase() === 'running').length}
                                    </p>
                                    <p className="text-sm text-slate-500">Running</p>
                                </div>
                                <div className="h-10 w-px bg-slate-200" />
                                <div className="flex gap-2">
                                    {['postgresql', 'mysql', 'mongodb', 'redis'].map(type => {
                                        const count = allDatabases.filter(d => d.db.type.toLowerCase() === type).length;
                                        if (count === 0) return null;
                                        const config = DB_ICONS[type];
                                        return (
                                            <div key={type} className={`flex items-center gap-1 px-2 py-1 rounded ${config.bgColor}`}>
                                                <span>{config.icon}</span>
                                                <span className={`font-medium ${config.color}`}>{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => refetch()}>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh
                                </Button>
                                <Button size="sm" asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                                    <Link href="/databases/new">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Database
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        {/* Database Grid */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {allDatabases.map(({ db, serverId, serverName }) => {
                                const dbConfig = DB_ICONS[db.type.toLowerCase()] || DB_ICONS.postgresql;
                                const statusConfig = STATUS_CONFIG[db.status.toLowerCase()] || STATUS_CONFIG.error;
                                const isDeleting = deletingId === db.id;

                                return (
                                    <Card
                                        key={db.id}
                                        className={`group hover:border-blue-300 hover:shadow-md transition-all h-full ${isDeleting ? 'opacity-50' : ''}`}
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <Link href={`/databases/${db.id}?server=${serverId}`} className="flex items-center gap-3 flex-1">
                                                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${dbConfig.bgColor}`}>
                                                        {dbConfig.icon}
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base group-hover:text-blue-600 transition-colors">{db.name}</CardTitle>
                                                        <CardDescription className="capitalize">{db.type}</CardDescription>
                                                    </div>
                                                </Link>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/databases/${db.id}?server=${serverId}`}>
                                                                    <Settings className="h-4 w-4 mr-2" />
                                                                    Manage
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            {db.status.toLowerCase() === 'running' ? (
                                                                <DropdownMenuItem
                                                                    className="text-amber-600"
                                                                    disabled={stoppingId === db.id}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        stopMutation.mutate({ serverId, dbId: db.id });
                                                                    }}
                                                                >
                                                                    {stoppingId === db.id ? (
                                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                    ) : (
                                                                        <StopCircle className="h-4 w-4 mr-2" />
                                                                    )}
                                                                    {stoppingId === db.id ? 'Stopping...' : 'Stop'}
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem
                                                                    className="text-emerald-600"
                                                                    disabled={startingId === db.id}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        startMutation.mutate({ serverId, dbId: db.id });
                                                                    }}
                                                                >
                                                                    {startingId === db.id ? (
                                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                    ) : (
                                                                        <PlayCircle className="h-4 w-4 mr-2" />
                                                                    )}
                                                                    {startingId === db.id ? 'Starting...' : 'Start'}
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setDeleteConfirm({ db, serverId });
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete Database
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-slate-500 space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Server className="h-3.5 w-3.5" />
                                                    <span>{serverName}</span>
                                                </div>
                                                {db.hostPort && (
                                                    <div className="flex items-center gap-2">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        <span>Port: {db.hostPort}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 pt-2">
                                                    {db.readOnly && (
                                                        <Badge variant="outline" className="text-xs">Read-only</Badge>
                                                    )}
                                                    <Badge variant="outline" className="text-xs capitalize">
                                                        {db.exposure || 'internal'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {/* Add Database Card */}
                            <Link href="/databases/new">
                                <Card className="border-dashed border-2 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer h-full min-h-[180px] flex items-center justify-center">
                                    <CardContent className="text-center py-8">
                                        <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                                            <Plus className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <p className="font-medium text-slate-900">Add Database</p>
                                        <p className="text-sm text-slate-500 mt-1">Deploy a new instance</p>
                                    </CardContent>
                                </Card>
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <AlertDialogTitle>Delete Database?</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-left">
                            This will permanently delete <strong>{deleteConfirm?.db.name}</strong> and all its data.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-2">
                        <p className="text-sm text-red-800">
                            <strong>Warning:</strong> All data stored in this database will be lost permanently.
                        </p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {deleteMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Database
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
