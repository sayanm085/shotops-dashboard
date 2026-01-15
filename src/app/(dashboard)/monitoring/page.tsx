"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Cpu, MemoryStick, HardDrive, Network, Server as ServerIcon, Activity,
    RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle,
    CheckCircle, Clock, Zap, ArrowUp, ArrowDown, Flame
} from "lucide-react";
import { api, type Server } from "@/lib/api";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, ReferenceLine, ReferenceArea
} from "recharts";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type SystemState = "NORMAL" | "ELEVATED" | "SATURATED" | "CRITICAL";
type TrendDirection = "rising" | "falling" | "stable";
type Bottleneck = "cpu" | "memory" | "disk" | "io" | "none";

const STATE_CONFIG: Record<SystemState, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle }> = {
    NORMAL: { label: "Normal", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle },
    ELEVATED: { label: "Elevated", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: TrendingUp },
    SATURATED: { label: "Saturated", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: AlertTriangle },
    CRITICAL: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: AlertCircle },
};

const THRESHOLDS = { normal: 50, warning: 70, critical: 90 };

interface ServerMetrics {
    timestamp: string;
    cpu: { percent: number; cores: number; loadAvg: number[] };
    memory: { used: number; free: number; total: number; cached: number; percent: number };
    disk: { used: number; total: number; percent: number };
    network: { bytesIn: number; bytesOut: number };
    uptime: number;
}

interface HistoricalData {
    range: string;
    startTime: string;
    endTime: string;
    dataPoints: number;
    series: {
        timestamps: string[];
        cpu: number[];
        memoryPercent: number[];
        diskPercent: number[];
        netIn: number[];
        netOut: number[];
        loadAvg1m: number[];
    };
    peak: { cpu: number; memory: number; disk: number };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getState(percent: number): SystemState {
    if (percent >= THRESHOLDS.critical) return "CRITICAL";
    if (percent >= THRESHOLDS.warning) return "SATURATED";
    if (percent >= THRESHOLDS.normal) return "ELEVATED";
    return "NORMAL";
}

function getTrend(current: number, peak: number): TrendDirection {
    const ratio = current / Math.max(peak, 1);
    if (ratio > 0.9) return "rising";
    if (ratio < 0.5) return "falling";
    return "stable";
}

function detectBottleneck(cpu: number, mem: number, disk: number): Bottleneck {
    const max = Math.max(cpu, mem, disk);
    if (max < THRESHOLDS.warning) return "none";
    if (cpu === max) return "cpu";
    if (mem === max) return "memory";
    return "disk";
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StateIndicator({ state }: { state: SystemState }) {
    const config = STATE_CONFIG[state];
    const Icon = config.icon;
    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${config.bg} ${config.border} border`}>
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>{config.label}</span>
        </div>
    );
}

function TrendIndicator({ direction, value }: { direction: TrendDirection; value?: string }) {
    const config = {
        rising: { icon: ArrowUp, color: "text-red-400", label: "Rising" },
        falling: { icon: ArrowDown, color: "text-emerald-400", label: "Falling" },
        stable: { icon: Minus, color: "text-slate-400", label: "Stable" },
    }[direction];
    const Icon = config.icon;
    return (
        <div className="flex items-center gap-1">
            <Icon className={`h-3 w-3 ${config.color}`} />
            <span className={`text-xs ${config.color}`}>{value || config.label}</span>
        </div>
    );
}

function MetricGauge({
    icon: Icon,
    label,
    current,
    peak,
    unit = "%",
    subtext,
    state,
    trend,
    priority = false,
}: {
    icon: React.ElementType;
    label: string;
    current: number;
    peak: number;
    unit?: string;
    subtext?: string;
    state: SystemState;
    trend: TrendDirection;
    priority?: boolean;
}) {
    const config = STATE_CONFIG[state];
    const percentage = Math.min(current, 100);

    return (
        <div className={`relative ${priority ? 'ring-2 ring-red-500/50' : ''}`}>
            <div className={`bg-slate-900 border ${priority ? 'border-red-500/50' : 'border-slate-700'} rounded-lg p-4`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="text-sm font-medium text-slate-300">{label}</span>
                    </div>
                    <StateIndicator state={state} />
                </div>

                {/* Main Value */}
                <div className="flex items-baseline gap-2 mb-2">
                    <span className={`text-4xl font-mono font-bold ${config.color}`}>
                        {current.toFixed(1)}
                    </span>
                    <span className="text-lg text-slate-500">{unit}</span>
                </div>

                {/* Progress Bar with Zones */}
                <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
                    {/* Zone markers */}
                    <div className="absolute inset-0 flex">
                        <div className="w-1/2 bg-emerald-900/30" />
                        <div className="w-[20%] bg-amber-900/30" />
                        <div className="w-[20%] bg-orange-900/30" />
                        <div className="w-[10%] bg-red-900/30" />
                    </div>
                    {/* Current value */}
                    <div
                        className={`absolute h-full transition-all duration-500 ${state === "CRITICAL" ? "bg-red-500" :
                                state === "SATURATED" ? "bg-orange-500" :
                                    state === "ELEVATED" ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                        style={{ width: `${percentage}%` }}
                    />
                    {/* Threshold markers */}
                    <div className="absolute h-full w-0.5 bg-amber-500/50" style={{ left: '50%' }} />
                    <div className="absolute h-full w-0.5 bg-orange-500/50" style={{ left: '70%' }} />
                    <div className="absolute h-full w-0.5 bg-red-500/50" style={{ left: '90%' }} />
                </div>

                {/* Stats Row */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                        <div className="text-slate-500">
                            Peak: <span className={`font-mono ${peak >= THRESHOLDS.warning ? 'text-orange-400' : 'text-slate-300'}`}>{peak.toFixed(1)}{unit}</span>
                        </div>
                        <TrendIndicator direction={trend} />
                    </div>
                    {subtext && <span className="text-slate-500">{subtext}</span>}
                </div>

                {/* Priority indicator */}
                {priority && (
                    <div className="absolute -top-2 -right-2">
                        <div className="flex items-center justify-center h-6 w-6 bg-red-500 rounded-full animate-pulse">
                            <Flame className="h-3 w-3 text-white" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function BottleneckIndicator({ bottleneck, metrics }: { bottleneck: Bottleneck; metrics: ServerMetrics }) {
    if (bottleneck === "none") {
        return (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">No Bottleneck Detected</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">System operating within normal parameters</p>
            </div>
        );
    }

    const labels: Record<Bottleneck, { title: string; description: string; icon: typeof Cpu }> = {
        cpu: { title: "CPU-Bound", description: "Processing capacity is the limiting factor", icon: Cpu },
        memory: { title: "Memory-Bound", description: "RAM utilization is constraining performance", icon: MemoryStick },
        disk: { title: "Disk-Bound", description: "Storage I/O is the limiting factor", icon: HardDrive },
        io: { title: "I/O-Bound", description: "Network or disk throughput limiting", icon: Network },
        none: { title: "", description: "", icon: CheckCircle },
    };

    const config = labels[bottleneck];
    const Icon = config.icon;

    return (
        <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400 mb-1">
                <Icon className="h-5 w-5" />
                <span className="font-semibold">{config.title}</span>
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] font-bold">BOTTLENECK</Badge>
            </div>
            <p className="text-sm text-red-300/70">{config.description}</p>
        </div>
    );
}

function PressureChart({
    data,
    dataKey,
    title,
    color,
    peak
}: {
    data: { time: string; value: number }[];
    dataKey: string;
    title: string;
    color: string;
    peak: number;
}) {
    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-300">{title}</h3>
                <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-slate-500">&lt;50%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-slate-500">50-70%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-slate-500">70-90%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-slate-500">&gt;90%</span>
                    </div>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {/* Danger zones */}
                    <ReferenceArea y1={90} y2={100} fill="rgba(239, 68, 68, 0.1)" />
                    <ReferenceArea y1={70} y2={90} fill="rgba(249, 115, 22, 0.05)" />
                    <ReferenceArea y1={50} y2={70} fill="rgba(245, 158, 11, 0.03)" />
                    {/* Threshold lines */}
                    <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={70} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.3} />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.2} />
                    {/* Peak line */}
                    <ReferenceLine y={peak} stroke="#8b5cf6" strokeDasharray="5 5" strokeOpacity={0.6} label={{ value: `Peak: ${peak.toFixed(0)}%`, fill: '#8b5cf6', fontSize: 10 }} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                        labelStyle={{ color: "#94a3b8" }}
                        itemStyle={{ color: color }}
                    />
                    <Area type="monotone" dataKey="value" stroke={color} fill={`url(#gradient-${dataKey})`} strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MonitoringPage() {
    const [selectedServer, setSelectedServer] = useState<string>("");
    const [timeRange, setTimeRange] = useState("1h");

    // Fetch servers
    const { data: servers = [] } = useQuery<Server[]>({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    // Auto-select first connected server
    useEffect(() => {
        if (servers.length > 0 && !selectedServer) {
            const connected = servers.find((s: Server) => s.status === "CONNECTED" || s.status === "connected");
            setSelectedServer(connected?.id || servers[0].id);
        }
    }, [servers, selectedServer]);

    // Fetch current metrics
    const { data: currentMetrics, refetch: refetchCurrent, isLoading } = useQuery({
        queryKey: ["metrics", selectedServer, "current"],
        queryFn: async () => {
            if (!selectedServer) return null;
            const res = await fetch(`http://localhost:4000/metrics/${selectedServer}/current`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            if (!res.ok) throw new Error("Failed to fetch metrics");
            return res.json() as Promise<ServerMetrics>;
        },
        enabled: !!selectedServer,
        refetchInterval: 5000,
    });

    // Fetch historical metrics
    const { data: historicalData } = useQuery({
        queryKey: ["metrics", selectedServer, "history", timeRange],
        queryFn: async () => {
            if (!selectedServer) return null;
            const res = await fetch(`http://localhost:4000/metrics/${selectedServer}/history?range=${timeRange}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            if (!res.ok) throw new Error("Failed to fetch history");
            return res.json() as Promise<HistoricalData>;
        },
        enabled: !!selectedServer,
        refetchInterval: 30000,
    });

    // Computed states
    const cpuState = currentMetrics ? getState(currentMetrics.cpu.percent) : "NORMAL";
    const memState = currentMetrics ? getState(currentMetrics.memory.percent) : "NORMAL";
    const diskState = currentMetrics ? getState(currentMetrics.disk.percent) : "NORMAL";

    const overallState = useMemo(() => {
        const states = [cpuState, memState, diskState];
        if (states.includes("CRITICAL")) return "CRITICAL";
        if (states.includes("SATURATED")) return "SATURATED";
        if (states.includes("ELEVATED")) return "ELEVATED";
        return "NORMAL";
    }, [cpuState, memState, diskState]);

    const bottleneck = currentMetrics
        ? detectBottleneck(currentMetrics.cpu.percent, currentMetrics.memory.percent, currentMetrics.disk.percent)
        : "none";

    // Chart data
    const cpuChartData = historicalData?.series.timestamps.map((ts, i) => ({
        time: new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        value: historicalData.series.cpu[i],
    })) || [];

    const memChartData = historicalData?.series.timestamps.map((ts, i) => ({
        time: new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        value: historicalData.series.memoryPercent[i],
    })) || [];

    const selectedServerData = servers.find(s => s.id === selectedServer);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Header Bar */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
                <div className="max-w-[1800px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-blue-400" />
                                <h1 className="text-lg font-semibold">System Monitor</h1>
                            </div>
                            <div className="h-6 w-px bg-slate-700" />
                            <Select value={selectedServer} onValueChange={setSelectedServer}>
                                <SelectTrigger className="w-64 bg-slate-800 border-slate-700 text-sm">
                                    <SelectValue placeholder="Select server" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    {servers.map(server => (
                                        <SelectItem key={server.id} value={server.id} className="text-slate-200">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full ${server.status === "CONNECTED" || server.status === "connected"
                                                        ? "bg-emerald-500" : "bg-slate-500"
                                                    }`} />
                                                {server.name || server.hostname}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedServerData && (
                                <StateIndicator state={overallState} />
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <Select value={timeRange} onValueChange={setTimeRange}>
                                <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-sm">
                                    <Clock className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    <SelectItem value="1h" className="text-slate-200">1 hour</SelectItem>
                                    <SelectItem value="6h" className="text-slate-200">6 hours</SelectItem>
                                    <SelectItem value="24h" className="text-slate-200">24 hours</SelectItem>
                                    <SelectItem value="7d" className="text-slate-200">7 days</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetchCurrent()}
                                className="bg-slate-800 border-slate-700 hover:bg-slate-700"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1800px] mx-auto px-6 py-6">
                {!currentMetrics ? (
                    <div className="flex items-center justify-center h-[60vh]">
                        <div className="text-center">
                            <Activity className="h-12 w-12 mx-auto text-slate-600 mb-4 animate-pulse" />
                            <p className="text-slate-500">Waiting for metrics...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Bottleneck Alert */}
                        <BottleneckIndicator bottleneck={bottleneck} metrics={currentMetrics} />

                        {/* Resource Gauges */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricGauge
                                icon={Cpu}
                                label="CPU"
                                current={currentMetrics.cpu.percent}
                                peak={historicalData?.peak.cpu || currentMetrics.cpu.percent}
                                state={cpuState}
                                trend={getTrend(currentMetrics.cpu.percent, historicalData?.peak.cpu || 100)}
                                subtext={`${currentMetrics.cpu.cores} cores • Load: ${currentMetrics.cpu.loadAvg[0].toFixed(2)}`}
                                priority={cpuState === "CRITICAL"}
                            />
                            <MetricGauge
                                icon={MemoryStick}
                                label="Memory"
                                current={currentMetrics.memory.percent}
                                peak={historicalData?.peak.memory || currentMetrics.memory.percent}
                                state={memState}
                                trend={getTrend(currentMetrics.memory.percent, historicalData?.peak.memory || 100)}
                                subtext={`${formatBytes(currentMetrics.memory.used)} / ${formatBytes(currentMetrics.memory.total)}`}
                                priority={memState === "CRITICAL"}
                            />
                            <MetricGauge
                                icon={HardDrive}
                                label="Disk"
                                current={currentMetrics.disk.percent}
                                peak={historicalData?.peak.disk || currentMetrics.disk.percent}
                                state={diskState}
                                trend={getTrend(currentMetrics.disk.percent, historicalData?.peak.disk || 100)}
                                subtext={`${formatBytes(currentMetrics.disk.used)} / ${formatBytes(currentMetrics.disk.total)}`}
                                priority={diskState === "CRITICAL"}
                            />
                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Clock className="h-4 w-4 text-blue-400" />
                                    <span className="text-sm font-medium text-slate-300">Uptime</span>
                                </div>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-4xl font-mono font-bold text-blue-400">
                                        {formatUptime(currentMetrics.uptime)}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                    Since {new Date(Date.now() - currentMetrics.uptime * 1000).toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        {/* Network Stats */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Network className="h-4 w-4 text-cyan-400" />
                                    <span className="text-sm font-medium text-slate-300">Network Throughput</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                            <ArrowDown className="h-3 w-3 text-emerald-400" />
                                            Inbound
                                        </div>
                                        <span className="text-2xl font-mono font-bold text-emerald-400">
                                            {formatBytes(currentMetrics.network.bytesIn)}/s
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                            <ArrowUp className="h-3 w-3 text-blue-400" />
                                            Outbound
                                        </div>
                                        <span className="text-2xl font-mono font-bold text-blue-400">
                                            {formatBytes(currentMetrics.network.bytesOut)}/s
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Zap className="h-4 w-4 text-violet-400" />
                                    <span className="text-sm font-medium text-slate-300">Peak Analysis ({timeRange})</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: "CPU Peak", value: historicalData?.peak.cpu || 0, icon: Cpu },
                                        { label: "Memory Peak", value: historicalData?.peak.memory || 0, icon: MemoryStick },
                                        { label: "Disk Peak", value: historicalData?.peak.disk || 0, icon: HardDrive },
                                    ].map((item) => (
                                        <div key={item.label}>
                                            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                                                <item.icon className="h-3 w-3" />
                                                {item.label}
                                            </div>
                                            <span className={`text-xl font-mono font-bold ${getState(item.value) === "CRITICAL" ? "text-red-400" :
                                                    getState(item.value) === "SATURATED" ? "text-orange-400" :
                                                        getState(item.value) === "ELEVATED" ? "text-amber-400" : "text-emerald-400"
                                                }`}>
                                                {item.value.toFixed(1)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <PressureChart
                                data={cpuChartData}
                                dataKey="cpu"
                                title="CPU Pressure"
                                color="#3b82f6"
                                peak={historicalData?.peak.cpu || 0}
                            />
                            <PressureChart
                                data={memChartData}
                                dataKey="memory"
                                title="Memory Pressure"
                                color="#8b5cf6"
                                peak={historicalData?.peak.memory || 0}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
