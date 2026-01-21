"use client";

import { useQuery } from "@tanstack/react-query";
import { Server, Terminal, WifiOff } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, Server as ServerType } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

export default function ServersPage() {
    const { data: servers = [], isLoading } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    return (
        <>
            <Header
                title="Servers"
                description="Your connected VPS instances"
            />

            <div className="p-6">
                {isLoading ? (
                    <div className="py-8 text-center text-slate-500">
                        Loading servers...
                    </div>
                ) : servers.length === 0 ? (
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                                <Server className="h-8 w-8 text-slate-600" />
                            </div>
                            <CardTitle className="text-xl">Install ShotOps on your server</CardTitle>
                            <CardDescription>
                                Run this command on your VPS to connect it
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="rounded-lg bg-slate-900 p-4">
                                <pre className="text-sm text-slate-100 overflow-x-auto">
                                    <code>curl -fsSL {apiUrl}/install | sudo bash</code>
                                </pre>
                            </div>

                            <div className="space-y-3 text-sm text-slate-600">
                                <p className="font-medium text-slate-900">What happens:</p>
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>Agent installs on your VPS</li>
                                    <li>Terminal prints a claim link</li>
                                    <li>Visit the link to add server to your account</li>
                                </ol>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Install command for adding more servers */}
                        <div className="mb-6 rounded-lg border border-dashed border-slate-300 p-4">
                            <p className="text-sm text-slate-500 mb-2">Add another server:</p>
                            <code className="text-sm bg-slate-100 px-3 py-1 rounded">
                                curl -fsSL {apiUrl}/install | sudo bash
                            </code>
                        </div>

                        {/* Server grid */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {servers.map((server) => (
                                <Card key={server.id} className="transition-colors hover:bg-slate-50 h-full">
                                    <CardContent className="pt-6">
                                        <Link href={`/servers/${server.id}`} className="block">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                                        <Server className="h-5 w-5 text-slate-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">
                                                            {server.name}
                                                        </p>
                                                        <p className="text-sm text-slate-500">{server.ip}</p>
                                                    </div>
                                                </div>
                                                <StatusBadge isLiveConnected={server.isLiveConnected} status={server.status} />
                                            </div>
                                        </Link>
                                        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                                            <span>Added {formatRelativeTime(server.createdAt)}</span>
                                            <Button variant="ghost" size="sm" className="h-8" asChild>
                                                <Link href={`/terminal?server=${server.id}`}>
                                                    <Terminal className="h-4 w-4 mr-1" />
                                                    Terminal
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

function StatusBadge({ isLiveConnected, status }: { isLiveConnected?: boolean; status: ServerType["status"] }) {
    // TRUTH: isLiveConnected is the single source of truth
    // If isLiveConnected is available, use it. Otherwise fall back to status.
    if (isLiveConnected === true) {
        return (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
                Online
            </Badge>
        );
    }

    if (isLiveConnected === false) {
        return (
            <Badge variant="secondary" className="bg-red-100 text-red-700">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
            </Badge>
        );
    }

    // Fallback for cases where isLiveConnected is not provided
    const variants: Record<string, { label: string; className: string }> = {
        connected: { label: "Online", className: "bg-green-100 text-green-700" },
        CONNECTED: { label: "Online", className: "bg-green-100 text-green-700" },
        pending: { label: "Connecting", className: "bg-yellow-100 text-yellow-700" },
        PENDING: { label: "Connecting", className: "bg-yellow-100 text-yellow-700" },
        disconnected: { label: "Offline", className: "bg-red-100 text-red-700" },
        DISCONNECTED: { label: "Offline", className: "bg-red-100 text-red-700" },
        UNCLAIMED: { label: "Unclaimed", className: "bg-purple-100 text-purple-700" },
        error: { label: "Error", className: "bg-red-100 text-red-700" },
        ERROR: { label: "Error", className: "bg-red-100 text-red-700" },
    };

    const { label, className } = variants[status] || { label: "Unknown", className: "bg-slate-100 text-slate-700" };

    return (
        <Badge variant="secondary" className={className}>
            {label}
        </Badge>
    );
}
