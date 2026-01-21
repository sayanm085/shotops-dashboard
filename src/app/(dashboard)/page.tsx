"use client";

import { useQuery } from "@tanstack/react-query";
import { Server, Box, Database } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, Server as ServerType } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
    const { data: servers = [], isLoading } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    const connectedServers = servers.filter((s) => s.status === "connected");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    // No servers - show simple install CTA
    if (!isLoading && servers.length === 0) {
        return (
            <>
                <Header title="Welcome to ShotOps" description="Connect your first server to get started" />

                <div className="flex items-center justify-center min-h-[60vh] p-6">
                    <Card className="max-w-xl w-full">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900">
                                <Server className="h-8 w-8 text-white" />
                            </div>
                            <CardTitle>Install ShotOps on your server</CardTitle>
                            <CardDescription>
                                Run this single command on any VPS
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="rounded-lg bg-slate-900 p-4">
                                <pre className="text-sm text-slate-100 overflow-x-auto">
                                    <code>curl -fsSL {apiUrl}/install | sudo bash</code>
                                </pre>
                            </div>

                            <div className="space-y-3 text-sm text-slate-600">
                                <p className="font-medium text-slate-900">After running:</p>
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>Agent installs automatically</li>
                                    <li>Terminal shows a claim link</li>
                                    <li>Visit the link to add server to your account</li>
                                    <li>Manage everything from this dashboard</li>
                                </ol>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    const stats = [
        {
            name: "Servers",
            value: servers.length,
            icon: Server,
            href: "/servers",
            description: `${connectedServers.length} online`,
        },
        {
            name: "Apps",
            value: 0,
            icon: Box,
            href: "/apps",
            description: "Deployed applications",
        },
        {
            name: "Databases",
            value: 0,
            icon: Database,
            href: "/databases",
            description: "Running instances",
        },
    ];

    return (
        <>
            <Header title="Overview" description="Your infrastructure at a glance" />

            <div className="p-6">
                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    {stats.map((stat) => (
                        <Link key={stat.name} href={stat.href}>
                            <Card className="transition-colors hover:bg-slate-50">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-500">
                                        {stat.name}
                                    </CardTitle>
                                    <stat.icon className="h-4 w-4 text-slate-400" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <p className="text-xs text-slate-500">{stat.description}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {/* Recent Servers */}
                <div className="mt-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">
                        Your Servers
                    </h2>

                    {isLoading ? (
                        <div className="py-8 text-center text-slate-500">
                            Loading servers...
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {servers.slice(0, 5).map((server) => (
                                <Link key={server.id} href={`/servers/${server.id}`}>
                                    <Card className="transition-colors hover:bg-slate-50">
                                        <CardContent className="flex items-center justify-between py-4">
                                            <div className="flex items-center gap-4">
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
                                            <div className="flex items-center gap-4">
                                                <StatusBadge status={server.status} isLiveConnected={server.isLiveConnected} />
                                                <span className="text-sm text-slate-500">
                                                    {formatRelativeTime(server.createdAt)}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add more servers */}
                <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-6 text-center">
                    <p className="text-sm text-slate-500 mb-2">Add another server:</p>
                    <code className="text-sm bg-slate-100 px-3 py-1 rounded">
                        curl -fsSL {apiUrl}/install | sudo bash
                    </code>
                </div>
            </div>
        </>
    );
}

function StatusBadge({ status, isLiveConnected }: { status: ServerType["status"]; isLiveConnected?: boolean }) {
    // TRUTH: Use isLiveConnected if available
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

    const variant = variants[status] || { label: "Unknown", className: "bg-slate-100 text-slate-700" };

    return (
        <Badge variant="secondary" className={variant.className}>
            {variant.label}
        </Badge>
    );
}
