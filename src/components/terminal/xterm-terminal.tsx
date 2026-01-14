"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface XTermTerminalProps {
    serverId: string;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: string) => void;
}

export function XTermTerminal({
    serverId,
    onConnect,
    onDisconnect,
    onError,
}: XTermTerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstanceRef = useRef<Terminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            theme: {
                background: "#0f172a",
                foreground: "#e2e8f0",
                cursor: "#e2e8f0",
                black: "#0f172a",
                red: "#ef4444",
                green: "#22c55e",
                yellow: "#eab308",
                blue: "#3b82f6",
                magenta: "#a855f7",
                cyan: "#06b6d4",
                white: "#e2e8f0",
                brightBlack: "#475569",
                brightRed: "#f87171",
                brightGreen: "#4ade80",
                brightYellow: "#facc15",
                brightBlue: "#60a5fa",
                brightMagenta: "#c084fc",
                brightCyan: "#22d3ee",
                brightWhite: "#f8fafc",
            },
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(terminalRef.current);
        fitAddon.fit();

        termInstanceRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // Connect WebSocket
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
        const token = localStorage.getItem("token");
        const ws = new WebSocket(`${wsUrl}/terminal/${serverId}?token=${token}`);

        ws.onopen = () => {
            terminal.writeln("Connected to server...\r\n");
            onConnect?.();
        };

        ws.onmessage = (event) => {
            terminal.write(event.data);
        };

        ws.onerror = () => {
            terminal.writeln("\r\n\x1b[31mConnection error\x1b[0m");
            onError?.("WebSocket connection failed");
        };

        ws.onclose = () => {
            terminal.writeln("\r\n\x1b[33mDisconnected\x1b[0m");
            onDisconnect?.();
        };

        wsRef.current = ws;

        // Send terminal input to server
        terminal.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "input", data }));
            }
        });

        // Handle resize
        const handleResize = () => {
            fitAddon.fit();
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                    JSON.stringify({
                        type: "resize",
                        cols: terminal.cols,
                        rows: terminal.rows,
                    })
                );
            }
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            ws.close();
            terminal.dispose();
        };
    }, [serverId, onConnect, onDisconnect, onError]);

    return (
        <div
            ref={terminalRef}
            className="h-full w-full rounded-lg bg-slate-900 p-2"
        />
    );
}
