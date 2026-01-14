"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Terminal } from "lucide-react";
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
    });

    const connectedServers = servers.filter((s) => s.status === "connected");

    return (
        <>
            <Header
                title="Terminal"
                description="Access your servers via web terminal"
            />

            <div className="flex h-[calc(100vh-64px)] flex-col p-6">
                <div className="mb-4">
                    <Select value={selectedServer} onValueChange={setSelectedServer}>
                        <SelectTrigger className="w-64">
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
                </div>

                {selectedServer ? (
                    <div className="flex-1 rounded-lg border border-slate-200 overflow-hidden">
                        <XTermTerminal serverId={selectedServer} />
                    </div>
                ) : (
                    <Card className="flex-1">
                        <CardContent className="flex h-full items-center justify-center">
                            <div className="text-center">
                                <Terminal className="mx-auto h-12 w-12 text-slate-300" />
                                <h3 className="mt-4 font-medium text-slate-900">
                                    Select a server
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {connectedServers.length === 0
                                        ? "No connected servers available"
                                        : "Choose a server to open a terminal session"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
