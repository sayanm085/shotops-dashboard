"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, Plus, Server, Play, Pause, Trash2, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, Database as DbType } from "@/lib/api";

// Database type icons
const DB_ICONS: Record<string, { color: string; icon: string }> = {
    postgresql: { color: "bg-blue-100 text-blue-600", icon: "🐘" },
    mysql: { color: "bg-orange-100 text-orange-600", icon: "🐬" },
    mongodb: { color: "bg-green-100 text-green-600", icon: "🍃" },
    redis: { color: "bg-red-100 text-red-600", icon: "⚡" },
};

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    creating: { variant: "secondary", label: "Creating..." },
    pending: { variant: "secondary", label: "Pending" },
    running: { variant: "default", label: "Running" },
    stopped: { variant: "outline", label: "Stopped" },
    error: { variant: "destructive", label: "Error" },
};

export default function DatabasesPage() {
    // Get all servers first
    const { data: servers = [] } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    // Get databases from all servers
    const { data: allDatabases = [], isLoading } = useQuery({
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

    const hasServers = servers.length > 0;
    const hasDatabases = allDatabases.length > 0;

    return (
        <>
            <Header
                title="Databases"
                description="Manage PostgreSQL, MySQL, MongoDB, and Redis instances"
            >
                {hasServers && (
                    <Button asChild>
                        <Link href="/databases/new">
                            <Plus className="h-4 w-4 mr-2" />
                            New Database
                        </Link>
                    </Button>
                )}
            </Header>

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
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Database className="mx-auto h-12 w-12 text-slate-300" />
                            <h3 className="mt-4 font-medium text-slate-900">No databases yet</h3>
                            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                Create your first database instance with one click
                            </p>
                            <Button className="mt-4" asChild>
                                <Link href="/databases/new">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Database
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {allDatabases.map(({ db, serverId, serverName }) => {
                            const dbConfig = DB_ICONS[db.type.toLowerCase()] || DB_ICONS.postgresql;
                            const statusConfig = STATUS_BADGES[db.status.toLowerCase()] || STATUS_BADGES.error;

                            return (
                                <Link key={db.id} href={`/databases/${db.id}?server=${serverId}`}>
                                    <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer h-full">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl ${dbConfig.color}`}>
                                                        {dbConfig.icon}
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base">{db.name}</CardTitle>
                                                        <CardDescription className="capitalize">{db.type}</CardDescription>
                                                    </div>
                                                </div>
                                                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-slate-500 space-y-1">
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
                                                {db.readOnly && (
                                                    <Badge variant="outline" className="text-xs">Read-only</Badge>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
