"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Server, Terminal, Trash2, RefreshCw, HardDrive, Cpu, MemoryStick, Globe, Clock, Box, WifiOff, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ServerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const serverId = params.id as string;

    const { data: server, isLoading, error } = useQuery({
        queryKey: ["server", serverId],
        queryFn: () => api.getServer(serverId),
        enabled: !!serverId,
    });

    const { data: apps = [] } = useQuery({
        queryKey: ["apps", serverId],
        queryFn: () => api.getApps(serverId),
        enabled: !!serverId,
    });

    const deleteMutation = useMutation({
        mutationFn: () => api.deleteServer(serverId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["servers"] });
            router.push("/servers");
        },
    });

    if (isLoading) {
        return (
            <>
                <Header title="Loading..." />
                <div className="p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-32 bg-slate-200 rounded-lg" />
                        <div className="h-48 bg-slate-200 rounded-lg" />
                    </div>
                </div>
            </>
        );
    }

    if (error || !server) {
        return (
            <>
                <Header title="Server Not Found" />
                <div className="p-6">
                    <Card className="max-w-lg mx-auto">
                        <CardContent className="pt-6 text-center">
                            <p className="text-slate-600 mb-4">This server could not be found.</p>
                            <Button asChild>
                                <Link href="/servers">Back to Servers</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    const statusColors: Record<string, string> = {
        CONNECTED: "bg-green-100 text-green-700",
        PENDING: "bg-yellow-100 text-yellow-700",
        DISCONNECTED: "bg-slate-100 text-slate-600",
        UNCLAIMED: "bg-purple-100 text-purple-700",
    };

    return (
        <>
            <Header
                title={server.name}
                description={server.ip || server.hostname}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={`/terminal?server=${serverId}`}>
                                <Terminal className="h-4 w-4 mr-2" />
                                Terminal
                            </Link>
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (confirm("Delete this server? This cannot be undone.")) {
                                    deleteMutation.mutate();
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    </div>
                }
            />

            <div className="p-6 space-y-6">
                {/* Status Card */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                    <Server className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Status</p>
                                    <Badge className={statusColors[server.status] || "bg-slate-100"}>
                                        {server.status}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                    <Globe className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">IP Address</p>
                                    <p className="font-medium">{server.ip || "N/A"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                    <Cpu className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">OS / Arch</p>
                                    <p className="font-medium">{server.os || "Linux"} / {server.arch || "amd64"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                    <Clock className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Last Seen</p>
                                    <p className="font-medium">
                                        {server.lastSeenAt ? formatRelativeTime(server.lastSeenAt) : "Never"}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* RECONNECTION GUIDE: Show when server is offline */}
                {(server.status === "DISCONNECTED" || server.status === "disconnected" || server.isLiveConnected === false) && (
                    <Alert variant="destructive" className="border-red-300 bg-red-50">
                        <WifiOff className="h-5 w-5" />
                        <AlertTitle className="text-red-800">Server Offline - Agent Disconnected</AlertTitle>
                        <AlertDescription className="text-red-700 space-y-3">
                            <p>This server's agent is not connected. To reconnect:</p>

                            <div className="bg-white border border-red-200 rounded-lg p-4 space-y-3">
                                <div>
                                    <p className="font-semibold text-slate-800 mb-1">Option 1: Restart the agent (if already installed)</p>
                                    <code className="block bg-slate-100 text-slate-800 px-3 py-2 rounded text-sm">
                                        sudo systemctl restart shotops-agent
                                    </code>
                                </div>

                                <div>
                                    <p className="font-semibold text-slate-800 mb-1">Option 2: Reinstall the agent</p>
                                    <code className="block bg-slate-100 text-slate-800 px-3 py-2 rounded text-sm">
                                        curl -fsSL {process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/install | sudo bash
                                    </code>
                                </div>

                                <div>
                                    <p className="font-semibold text-slate-800 mb-1">Option 3: Check agent logs</p>
                                    <code className="block bg-slate-100 text-slate-800 px-3 py-2 rounded text-sm">
                                        sudo journalctl -u shotops-agent -f
                                    </code>
                                </div>
                            </div>

                            <p className="text-sm">Last seen: {server.lastSeenAt ? formatRelativeTime(server.lastSeenAt) : "Never"}</p>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Apps Section */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Applications</CardTitle>
                        <Button asChild>
                            <Link href={`/apps/new?server=${serverId}`}>
                                Deploy App
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {apps.length === 0 ? (
                            <div className="py-8 text-center text-slate-500">
                                <Box className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                                <p>No applications deployed yet</p>
                                <Button variant="link" asChild className="mt-2">
                                    <Link href={`/apps/new?server=${serverId}`}>Deploy your first app</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {apps.map((app: any) => (
                                    <Link
                                        key={app.id}
                                        href={`/apps/${app.id}`}
                                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Box className="h-5 w-5 text-slate-400" />
                                            <div>
                                                <p className="font-medium">{app.name}</p>
                                                <p className="text-sm text-slate-500">{app.domain || "No domain"}</p>
                                            </div>
                                        </div>
                                        <Badge variant="secondary">{app.status}</Badge>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Server Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm text-slate-500">Server ID</dt>
                                <dd className="font-mono text-sm">{server.id}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-slate-500">Hostname</dt>
                                <dd className="font-medium">{server.hostname || "Unknown"}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-slate-500">Agent Version</dt>
                                <dd className="font-medium">{server.agentVersion || "Unknown"}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-slate-500">Connected At</dt>
                                <dd className="font-medium">
                                    {server.connectedAt ? formatRelativeTime(server.connectedAt) : "Never"}
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
