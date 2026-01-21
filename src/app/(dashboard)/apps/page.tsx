"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, Plus, Globe, WifiOff } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, App, Server } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

interface AppWithServer extends App {
    serverId: string;
    serverName: string;
    isServerLive?: boolean;  // TRUTH: Is the server's agent currently connected?
}

export default function AppsPage() {
    const { data: servers = [] } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    // Fetch apps from all servers
    const { data: allApps = [], isLoading } = useQuery({
        queryKey: ["all-apps", servers.map(s => s.id)],
        queryFn: async () => {
            const appsPromises = servers.map(async (server: Server) => {
                try {
                    const apps = await api.getApps(server.id);
                    return apps.map((app: App) => ({
                        ...app,
                        serverId: server.id,
                        serverName: server.name,
                        // TRUTH: Include live connection status
                        isServerLive: server.isLiveConnected === true,
                    }));
                } catch {
                    return [];
                }
            });
            const results = await Promise.all(appsPromises);
            return results.flat() as AppWithServer[];
        },
        enabled: servers.length > 0,
    });

    // TRUTH: Only show live-connected servers for deployment
    const liveServers = servers.filter(
        (s) => s.isLiveConnected === true
    );

    const statusColors: Record<string, string> = {
        running: "bg-green-100 text-green-700",
        RUNNING: "bg-green-100 text-green-700",
        deploying: "bg-blue-100 text-blue-700",
        DEPLOYING: "bg-blue-100 text-blue-700",
        pending: "bg-yellow-100 text-yellow-700",
        PENDING: "bg-yellow-100 text-yellow-700",
        stopped: "bg-slate-100 text-slate-600",
        STOPPED: "bg-slate-100 text-slate-600",
        error: "bg-red-100 text-red-700",
        ERROR: "bg-red-100 text-red-700",
    };

    return (
        <>
            <Header
                title="Apps"
                description="Deploy and manage your applications"
                actions={
                    liveServers.length > 0 && (
                        <Button asChild>
                            <Link href="/apps/new">
                                <Plus className="h-4 w-4 mr-2" />
                                Deploy App
                            </Link>
                        </Button>
                    )
                }
            />

            <div className="p-6">
                {isLoading ? (
                    <div className="animate-pulse space-y-4">
                        <div className="h-24 bg-slate-200 rounded-lg" />
                        <div className="h-24 bg-slate-200 rounded-lg" />
                    </div>
                ) : allApps.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Box className="mx-auto h-12 w-12 text-slate-300" />
                            <h3 className="mt-4 font-medium text-slate-900">No apps yet</h3>
                            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                {liveServers.length === 0
                                    ? "No servers online. Connect an agent to deploy applications."
                                    : "Deploy your first application to get started"}
                            </p>
                            <Button className="mt-4" asChild>
                                {liveServers.length === 0 ? (
                                    <Link href="/servers">Go to Servers</Link>
                                ) : (
                                    <Link href="/apps/new">Deploy App</Link>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {allApps.map((app) => (
                            <Link key={app.id} href={`/apps/${app.id}`}>
                                <Card className="h-full transition-colors hover:bg-slate-50 cursor-pointer">
                                    <CardContent className="pt-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                                    <Box className="h-5 w-5 text-slate-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">
                                                        {app.name}
                                                    </p>
                                                    <p className="text-sm text-slate-500">
                                                        {app.serverName}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge
                                                className={
                                                    statusColors[app.status] || "bg-slate-100"
                                                }
                                            >
                                                {app.status}
                                            </Badge>
                                            {/* TRUTH: Show offline badge if server is not live connected */}
                                            {app.isServerLive === false && (
                                                <Badge variant="destructive" className="text-xs">
                                                    <WifiOff className="h-3 w-3 mr-1" />
                                                    Offline
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                {app.domain ? (
                                                    <>
                                                        <Globe className="h-3 w-3" />
                                                        {app.domain}
                                                    </>
                                                ) : (
                                                    "No domain"
                                                )}
                                            </span>
                                            <span>{formatRelativeTime(app.createdAt)}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
