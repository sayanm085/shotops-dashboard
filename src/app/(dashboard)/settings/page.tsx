"use client";

import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
    const { user } = useAuth();

    return (
        <>
            <Header
                title="Settings"
                description="Manage your account settings"
            />

            <div className="p-6 max-w-2xl">
                <div className="space-y-6">
                    {/* Profile Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile</CardTitle>
                            <CardDescription>Your account information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    defaultValue={user?.name || ""}
                                    placeholder="Your name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    defaultValue={user?.email || ""}
                                    disabled
                                    className="bg-slate-50"
                                />
                            </div>
                            <Button>Save Changes</Button>
                        </CardContent>
                    </Card>

                    {/* Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Adding Servers</CardTitle>
                            <CardDescription>
                                How to connect your VPS to ShotOps
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-slate-600">
                            <ol className="list-decimal list-inside space-y-2">
                                <li>Go to <strong>Servers</strong> page</li>
                                <li>Click <strong>Generate Install Command</strong></li>
                                <li>Copy the command and run it on your VPS via SSH</li>
                                <li>Your server will appear automatically</li>
                            </ol>
                            <p className="text-slate-500">
                                Install commands are one-time use and expire in 15 minutes for security.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
