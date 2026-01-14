"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Server, Check, Loader2, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

type ClaimStatus = "loading" | "pending" | "claiming" | "success" | "expired" | "error";

export default function ClaimPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [status, setStatus] = useState<ClaimStatus>("loading");
    const [serverInfo, setServerInfo] = useState<{ hostname: string; os: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const token = params.token as string;

    useEffect(() => {
        async function checkStatus() {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agent/claim/${token}/status`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "pending") {
                        setServerInfo({ hostname: data.hostname, os: data.os });
                        setStatus("pending");
                    } else if (data.status === "claimed") {
                        router.push("/servers");
                    } else if (data.status === "expired") {
                        setStatus("expired");
                    }
                } else {
                    setError("This claim link is invalid or has expired.");
                    setStatus("error");
                }
            } catch {
                setError("Failed to check claim status.");
                setStatus("error");
            }
        }

        if (token) {
            checkStatus();
        }
    }, [token, router]);

    const handleClaim = async () => {
        if (!user) {
            router.push(`/login?redirect=/claim/${token}`);
            return;
        }

        setStatus("claiming");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agent/claim/${token}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            const data = await res.json();

            if (res.ok) {
                setStatus("success");
                setTimeout(() => {
                    router.push(`/servers/${data.server.id}`);
                }, 1500);
            } else {
                setError(data.message || "Failed to claim server");
                setStatus("error");
            }
        } catch {
            setError("Failed to claim server");
            setStatus("error");
        }
    };

    if (authLoading || status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900">
                        <Server className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle>
                        {status === "error" ? "Claim Failed" :
                            status === "expired" ? "Link Expired" :
                                status === "success" ? "Server Claimed!" :
                                    "Claim Your Server"}
                    </CardTitle>
                    <CardDescription>
                        {status === "error" ? error :
                            status === "expired" ? "Please reinstall the agent to get a new link." :
                                status === "success" ? "Redirecting to dashboard..." :
                                    "This server is not linked to any account yet."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {status === "error" && (
                        <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {status === "expired" && (
                        <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-4 text-yellow-700">
                            <Clock className="h-5 w-5 flex-shrink-0" />
                            <p className="text-sm">This claim link has expired. Run the install command again on your VPS.</p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-700">
                            <Check className="h-5 w-5 flex-shrink-0" />
                            <p className="text-sm">Server claimed successfully!</p>
                        </div>
                    )}

                    {status === "pending" && serverInfo && (
                        <>
                            <div className="rounded-lg bg-slate-50 p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Hostname</span>
                                    <span className="font-medium">{serverInfo.hostname}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">OS</span>
                                    <span className="font-medium">{serverInfo.os}</span>
                                </div>
                            </div>

                            {!user ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-600 text-center">
                                        Login or create an account to claim this server.
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => router.push(`/login?redirect=/claim/${token}`)}
                                        >
                                            Login
                                        </Button>
                                        <Button
                                            onClick={() => router.push(`/register?redirect=/claim/${token}`)}
                                        >
                                            Register
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    onClick={handleClaim}
                                    className="w-full"
                                    size="lg"
                                >
                                    Claim This Server
                                </Button>
                            )}

                            <p className="text-xs text-slate-400 text-center">
                                ⏱ Claim link expires in 15 minutes
                            </p>
                        </>
                    )}

                    {status === "claiming" && (
                        <div className="flex items-center justify-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Claiming server...</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
