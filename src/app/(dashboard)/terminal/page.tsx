"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Terminal, WifiOff, AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Dynamic import to avoid SSR issues with xterm
const XTermTerminal = dynamic(
    () =>
        import("@/components/terminal/xterm-terminal").then(
            (mod) => mod.XTermTerminal
        ),
    { ssr: false }
);

export default function TerminalPage() {
    const [selectedServer, setSelectedServer] = useState<string>("");

    const { data: servers = [] } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
        refetchInterval: 5000, // Poll every 5s for live status
    });

    // TRUTH: Only show servers with LIVE agent connections
    const liveServers = servers.filter((s) => s.isLiveConnected === true);

    // Check if selected server is still live
    const selectedServerData = servers.find((s) => s.id === selectedServer);
    const isSelectedServerLive = selectedServerData?.isLiveConnected === true;

    return (
        <>
            <Header
                title="Terminal"
                description="Access your servers via web terminal"
            />

            <div className="flex h-[calc(100vh-64px)] flex-col p-6">
                {/* Offline warning for all servers */}
                {servers.length > 0 && liveServers.length === 0 && (
                    <Alert variant="destructive" className="mb-4">
                        <WifiOff className="h-4 w-4" />
                        <AlertTitle>All servers offline</AlertTitle>
                        <AlertDescription>
                            Terminal unavailable – no servers have active agent connections.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="mb-4">
                    <Select
                        value={selectedServer}
                        onValueChange={setSelectedServer}
                        disabled={liveServers.length === 0}
                    >
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder={liveServers.length === 0 ? "No servers online" : "Select a server"} />
                        </SelectTrigger>
                        <SelectContent>
                            {liveServers.map((server) => (
                                <SelectItem key={server.id} value={server.id}>
                                    {server.name} ({server.ip})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedServer && isSelectedServerLive ? (
                    <div className="flex-1 rounded-lg border border-slate-200 overflow-hidden">
                        <XTermTerminal serverId={selectedServer} />
                    </div>
                ) : selectedServer && !isSelectedServerLive ? (
                    <Card className="flex-1">
                        <CardContent className="flex h-full items-center justify-center">
                            <div className="text-center">
                                <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
                                <h3 className="mt-4 font-medium text-slate-900">
                                    Server disconnected
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Terminal unavailable – agent connection lost. Select another server.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="flex-1">
                        <CardContent className="flex h-full items-center justify-center">
                            <div className="text-center">
                                {liveServers.length === 0 ? (
                                    <>
                                        <WifiOff className="mx-auto h-12 w-12 text-red-400" />
                                        <h3 className="mt-4 font-medium text-slate-900">
                                            No servers online
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Terminal requires active agent connection
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <Terminal className="mx-auto h-12 w-12 text-slate-300" />
                                        <h3 className="mt-4 font-medium text-slate-900">
                                            Select a server
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Choose a server to open a terminal session
                                        </p>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

