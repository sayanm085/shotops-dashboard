"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Globe, GitBranch, Play, Square, RefreshCw, Trash2, ArrowLeft, Clock, ExternalLink, Terminal, FileText, Rocket, StopCircle, Save, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressModal, parseError } from "@/components/ui/progress-modal";
import { EnvVarsEditor, EnvVar } from "@/components/ui/env-vars-editor";
import { api, App } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

export default function AppDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const appId = params.id as string;

    // We need to find which server this app belongs to
    // For now, we'll fetch all servers and find the app
    const { data: servers = [] } = useQuery({
        queryKey: ["servers"],
        queryFn: () => api.getServers(),
    });

    // Find the app across all servers
    const { data: appData, isLoading, error } = useQuery({
        queryKey: ["app", appId],
        queryFn: async () => {
            // Search for the app in all servers' apps
            for (const server of servers) {
                try {
                    const apps = await api.getApps(server.id);
                    const app = apps.find((a: App) => a.id === appId);
                    if (app) {
                        return { app, server };
                    }
                } catch {
                    continue;
                }
            }
            return null;
        },
        enabled: servers.length > 0,
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!appData) throw new Error("App not found");
            return api.deleteApp(appData.server.id, appId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["apps"] });
            router.push("/apps");
        },
    });

    const stopMutation = useMutation({
        mutationFn: async () => {
            if (!appData) throw new Error("App not found");
            return api.stopApp(appData.server.id, appId);
        },
        onSuccess: () => {
            pollForUpdates("stop");
        },
    });

    const deployMutation = useMutation({
        mutationFn: async () => {
            if (!appData) throw new Error("App not found");
            return api.deployApp(appData.server.id, appId);
        },
        onSuccess: () => {
            pollForUpdates("deploy");
        },
    });

    // Env vars state and mutation
    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [envVarsChanged, setEnvVarsChanged] = useState(false);

    // Initialize envVars from app data
    useEffect(() => {
        if (appData?.app?.envVars) {
            const vars = Object.entries(appData.app.envVars as Record<string, string>).map(([key, value]) => ({
                key,
                value,
                isSecret: key.toLowerCase().includes("secret") || key.toLowerCase().includes("password") || key.toLowerCase().includes("key") || key.toLowerCase().includes("token"),
            }));
            setEnvVars(vars);
        }
    }, [appData]);

    const updateEnvVarsMutation = useMutation({
        mutationFn: async () => {
            if (!appData) throw new Error("App not found");
            const envVarsObj = envVars.reduce((acc, v) => {
                if (v.key) acc[v.key] = v.value;
                return acc;
            }, {} as Record<string, string>);
            return api.updateAppEnvVars(appData.server.id, appId, envVarsObj);
        },
        onSuccess: () => {
            setEnvVarsChanged(false);
            queryClient.invalidateQueries({ queryKey: ["app", appId] });
        },
        onError: (error) => {
            console.error("Failed to update env vars:", error);
        },
    });

    const handleEnvVarsChange = (newVars: EnvVar[]) => {
        setEnvVars(newVars);
        setEnvVarsChanged(true);
    };

    const [isSavingAndRedeploying, setIsSavingAndRedeploying] = useState(false);

    const saveAndRedeploy = async () => {
        try {
            setIsSavingAndRedeploying(true);
            // First save the env vars
            await updateEnvVarsMutation.mutateAsync();
            // Then trigger deploy which will show the progress modal
            deployMutation.mutate();
        } catch (error) {
            console.error("Save and redeploy failed:", error);
            setIsSavingAndRedeploying(false);
        }
    };

    // Reset saving state when deploy completes
    useEffect(() => {
        if (!deployMutation.isPending && isSavingAndRedeploying) {
            setIsSavingAndRedeploying(false);
        }
    }, [deployMutation.isPending, isSavingAndRedeploying]);

    // Logs query
    const { data: logsData, refetch: refetchLogs } = useQuery({
        queryKey: ["appLogs", appId],
        queryFn: async () => {
            if (!appData) return null;
            return api.getAppLogs(appData.server.id, appId);
        },
        enabled: !!appData,
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    const [showLogs, setShowLogs] = useState(false);

    // Progress modal state
    const [progressModal, setProgressModal] = useState<{
        isOpen: boolean;
        title: string;
        type: "deploy" | "stop" | "delete";
        progress: number;
        steps: { label: string; status: "pending" | "running" | "completed" | "error" }[];
        logs: string;
        error: string;
    }>({
        isOpen: false,
        title: "",
        type: "deploy",
        progress: 0,
        steps: [],
        logs: "",
        error: "",
    });

    // Poll for status updates during operations
    const pollForUpdates = useCallback(async (operationType: "deploy" | "stop" | "delete") => {
        if (!appData) return;

        const steps: Record<string, { label: string; status: "pending" | "running" | "completed" | "error" }[]> = {
            deploy: [
                { label: "Downloading source code", status: "running" },
                { label: "Detecting project type", status: "pending" },
                { label: "Building Docker image", status: "pending" },
                { label: "Starting container", status: "pending" },
                { label: "Running health check", status: "pending" },
            ],
            stop: [
                { label: "Stopping Docker container", status: "running" },
                { label: "Cleaning up resources", status: "pending" },
            ],
            delete: [
                { label: "Stopping container", status: "running" },
                { label: "Removing Docker resources", status: "pending" },
                { label: "Deleting files", status: "pending" },
            ],
        };

        setProgressModal({
            isOpen: true,
            title: operationType === "deploy" ? "Deploying Application" :
                operationType === "stop" ? "Stopping Application" : "Deleting Application",
            type: operationType,
            progress: 10,
            steps: steps[operationType],
            logs: "",
            error: "",
        });

        // Poll for status updates
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds max

        const pollInterval = setInterval(async () => {
            attempts++;
            try {
                const logs = await api.getAppLogs(appData.server.id, appId);
                const currentLogs = logs.logs || "";

                // Parse logs to determine current step
                let currentStep = 0;
                let progress = 20;

                if (operationType === "deploy") {
                    if (currentLogs.includes("Downloaded") || currentLogs.includes("Downloading")) {
                        currentStep = 1;
                        progress = 30;
                    }
                    if (currentLogs.includes("Found") || currentLogs.includes("Detected")) {
                        currentStep = 2;
                        progress = 45;
                    }
                    if (currentLogs.includes("Building") || currentLogs.includes("docker-compose")) {
                        currentStep = 3;
                        progress = 60;
                    }
                    if (currentLogs.includes("Starting") || currentLogs.includes("Creating")) {
                        currentStep = 4;
                        progress = 80;
                    }
                    if (currentLogs.includes("success") || logs.status === "running") {
                        currentStep = 5;
                        progress = 100;
                    }
                } else if (operationType === "stop") {
                    if (currentLogs.includes("Stopping") || currentLogs.includes("docker-compose")) {
                        currentStep = 1;
                        progress = 50;
                    }
                    if (currentLogs.includes("stopped") || logs.status === "stopped") {
                        currentStep = 2;
                        progress = 100;
                    }
                }

                const updatedSteps = steps[operationType].map((step, i) => ({
                    ...step,
                    status: i < currentStep ? "completed" as const :
                        i === currentStep ? "running" as const : "pending" as const,
                }));

                // Check for completion or error
                const isComplete = logs.status === "running" || logs.status === "stopped" || logs.status === "error";
                const hasError = logs.status === "error" || currentLogs.toLowerCase().includes("failed");

                if (hasError) {
                    updatedSteps[currentStep] = { ...updatedSteps[currentStep], status: "error" };
                    setProgressModal(prev => ({
                        ...prev,
                        progress: 100,
                        steps: updatedSteps,
                        logs: currentLogs,
                        error: parseError(currentLogs),
                    }));
                    clearInterval(pollInterval);
                    queryClient.invalidateQueries({ queryKey: ["app", appId] });
                    return;
                }

                setProgressModal(prev => ({
                    ...prev,
                    progress,
                    steps: updatedSteps,
                    logs: currentLogs,
                }));

                if (isComplete && !hasError) {
                    updatedSteps.forEach((_, i) => {
                        updatedSteps[i] = { ...updatedSteps[i], status: "completed" };
                    });
                    setProgressModal(prev => ({
                        ...prev,
                        progress: 100,
                        steps: updatedSteps,
                        logs: currentLogs,
                    }));
                    clearInterval(pollInterval);
                    queryClient.invalidateQueries({ queryKey: ["app", appId] });
                    refetchLogs();
                }

                if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                }
            } catch {
                // Continue polling
            }
        }, 1000);
    }, [appData, appId, queryClient, refetchLogs]);

    const closeProgressModal = useCallback(() => {
        setProgressModal(prev => ({ ...prev, isOpen: false }));
        queryClient.invalidateQueries({ queryKey: ["app", appId] });
        queryClient.invalidateQueries({ queryKey: ["appLogs", appId] });
    }, [appId, queryClient]);

    if (isLoading || servers.length === 0) {
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

    if (error || !appData) {
        return (
            <>
                <Header title="App Not Found" />
                <div className="p-6">
                    <Card className="max-w-lg mx-auto">
                        <CardContent className="pt-6 text-center">
                            <Box className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                            <p className="text-slate-600 mb-4">This application could not be found.</p>
                            <Button asChild>
                                <Link href="/apps">Back to Apps</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    const { app, server } = appData;

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
                title={app.name}
                description={`Deployed on ${server.name}`}
                actions={
                    <div className="flex gap-2">
                        {app.status === "running" || app.status === "RUNNING" ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => stopMutation.mutate()}
                                disabled={stopMutation.isPending}
                            >
                                <Square className="h-4 w-4 mr-2" />
                                {stopMutation.isPending ? "Stopping..." : "Stop"}
                            </Button>
                        ) : (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => deployMutation.mutate()}
                                disabled={deployMutation.isPending}
                            >
                                <Play className="h-4 w-4 mr-2" />
                                {deployMutation.isPending ? "Deploying..." : "Deploy"}
                            </Button>
                        )}
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                if (confirm("Delete this app? This cannot be undone.")) {
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
                <Button variant="ghost" asChild className="mb-2">
                    <Link href="/apps">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Apps
                    </Link>
                </Button>

                {/* Status Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                    <Box className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Status</p>
                                    <Badge className={statusColors[app.status] || "bg-slate-100"}>
                                        {app.status.toUpperCase()}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={app.domain ? "border-blue-200 bg-blue-50/50" : ""}>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${app.domain ? "bg-blue-100" : "bg-slate-100"}`}>
                                    <Globe className={`h-5 w-5 ${app.domain ? "text-blue-600" : "text-slate-600"}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-slate-500">Domain</p>
                                        {app.domain && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Public</span>}
                                    </div>
                                    {app.domain ? (
                                        <>
                                            <a
                                                href={`https://${app.domain}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                {app.domain}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Accessible publicly from anywhere on the internet.
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-slate-400">No domain configured</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Port Card */}
                    <Card className={app.port ? "border-green-200 bg-green-50/50" : ""}>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${app.port ? "bg-green-100" : "bg-slate-100"}`}>
                                    <ExternalLink className={`h-5 w-5 ${app.port ? "text-green-600" : "text-slate-600"}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-slate-500">Port</p>
                                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Local Only</span>
                                    </div>
                                    {app.port ? (
                                        <>
                                            <a
                                                href={`http://localhost:${app.port}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-green-600 hover:underline flex items-center gap-1"
                                            >
                                                localhost:{app.port}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Only accessible from the server. Use a domain for public access.
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-slate-400">Not running</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                    <GitBranch className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Source</p>
                                    <p className="font-medium">
                                        {app.gitUrl ? `${app.branch || "main"}` : "File Upload"}
                                    </p>
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
                                    <p className="text-sm text-slate-500">Created</p>
                                    <p className="font-medium">
                                        {formatRelativeTime(app.createdAt)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Deployment Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Deployment Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm text-slate-500">App ID</dt>
                                <dd className="font-mono text-sm">{app.id}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-slate-500">Server</dt>
                                <dd>
                                    <Link href={`/servers/${server.id}`} className="text-blue-600 hover:underline">
                                        {server.name}
                                    </Link>
                                </dd>
                            </div>
                            {app.gitUrl && (
                                <>
                                    <div>
                                        <dt className="text-sm text-slate-500">Repository</dt>
                                        <dd>
                                            <a
                                                href={app.gitUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                {app.gitUrl}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-slate-500">Branch</dt>
                                        <dd className="font-medium">{app.branch || "main"}</dd>
                                    </div>
                                </>
                            )}
                            {app.port && (
                                <div>
                                    <dt className="text-sm text-slate-500">Port</dt>
                                    <dd className="font-medium">{app.port}</dd>
                                </div>
                            )}
                        </dl>
                    </CardContent>
                </Card>

                {/* Environment Variables */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Environment Variables</CardTitle>
                        <CardDescription>
                            Manage secrets and configuration. Changes require redeploy to take effect.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <EnvVarsEditor
                            envVars={envVars}
                            onChange={handleEnvVarsChange}
                        />

                        {envVarsChanged && (
                            <div className="flex gap-2 pt-2">
                                <Button
                                    onClick={() => updateEnvVarsMutation.mutate()}
                                    disabled={updateEnvVarsMutation.isPending}
                                    variant="outline"
                                    className="gap-2"
                                >
                                    {updateEnvVarsMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    Save Only
                                </Button>
                                <Button
                                    onClick={saveAndRedeploy}
                                    disabled={isSavingAndRedeploying || updateEnvVarsMutation.isPending || deployMutation.isPending}
                                    className="gap-2 bg-violet-600 hover:bg-violet-500"
                                >
                                    {isSavingAndRedeploying ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Rocket className="h-4 w-4" />
                                    )}
                                    {isSavingAndRedeploying ? "Saving & Deploying..." : "Save & Redeploy"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Actions</CardTitle>
                        <CardDescription>Manage your application</CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => deployMutation.mutate()}
                            disabled={deployMutation.isPending}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Redeploy
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowLogs(!showLogs);
                                if (!showLogs) refetchLogs();
                            }}
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            {showLogs ? "Hide Logs" : "View Logs"}
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href={`/terminal?server=${server.id}`}>
                                <Terminal className="h-4 w-4 mr-2" />
                                Terminal
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* Deployment Logs */}
                {showLogs && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Terminal className="h-5 w-5" />
                                Deployment Logs
                            </CardTitle>
                            <CardDescription>
                                {logsData?.deployedAt
                                    ? `Last deployed ${formatRelativeTime(logsData.deployedAt)}`
                                    : "No deployment yet"
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono whitespace-pre-wrap">
                                {logsData?.logs || "No deployment logs available. Deploy the app to see logs."}
                            </pre>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Progress Modal */}
            <ProgressModal
                isOpen={progressModal.isOpen}
                title={progressModal.title}
                icon={progressModal.type === "deploy" ? <Rocket className="h-6 w-6" /> :
                    progressModal.type === "stop" ? <StopCircle className="h-6 w-6" /> :
                        <Trash2 className="h-6 w-6" />}
                steps={progressModal.steps}
                logs={progressModal.logs}
                error={progressModal.error}
                progress={progressModal.progress}
                onClose={closeProgressModal}
            />
        </>
    );
}
