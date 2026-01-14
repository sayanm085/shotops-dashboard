"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Eye, EyeOff, FileText, Sparkles, ChevronDown, ChevronUp, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface EnvVar {
    key: string;
    value: string;
    isSecret?: boolean;
}

interface EnvVarsEditorProps {
    envVars: EnvVar[];
    onChange: (vars: EnvVar[]) => void;
    className?: string;
}

export function EnvVarsEditor({ envVars, onChange, className }: EnvVarsEditorProps) {
    const [showSecrets, setShowSecrets] = useState<Set<number>>(new Set());
    const [isExpanded, setIsExpanded] = useState(envVars.length > 0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addVariable = () => {
        onChange([...envVars, { key: "", value: "", isSecret: false }]);
        setIsExpanded(true);
    };

    const removeVariable = (index: number) => {
        onChange(envVars.filter((_, i) => i !== index));
        showSecrets.delete(index);
        setShowSecrets(new Set(showSecrets));
    };

    const updateVariable = (index: number, field: keyof EnvVar, value: string | boolean) => {
        const updated = [...envVars];
        updated[index] = { ...updated[index], [field]: value };
        onChange(updated);
    };

    const toggleSecret = (index: number) => {
        const newShowSecrets = new Set(showSecrets);
        if (newShowSecrets.has(index)) {
            newShowSecrets.delete(index);
        } else {
            newShowSecrets.add(index);
        }
        setShowSecrets(newShowSecrets);
    };

    const generateRandomValue = (index: number) => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let result = "";
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        updateVariable(index, "value", result);
        updateVariable(index, "isSecret", true);
    };

    const handleEnvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split("\n");
            const newVars: EnvVar[] = [];

            for (const line of lines) {
                const trimmed = line.trim();
                // Skip comments and empty lines
                if (!trimmed || trimmed.startsWith("#")) continue;

                const eqIndex = trimmed.indexOf("=");
                if (eqIndex === -1) continue;

                const key = trimmed.substring(0, eqIndex).trim();
                let value = trimmed.substring(eqIndex + 1).trim();

                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                // Detect if it looks like a secret
                const isSecret = key.toLowerCase().includes("secret") ||
                    key.toLowerCase().includes("password") ||
                    key.toLowerCase().includes("key") ||
                    key.toLowerCase().includes("token");

                newVars.push({ key, value, isSecret });
            }

            onChange([...envVars, ...newVars]);
            setIsExpanded(true);
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    return (
        <div className={cn("rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm", className)}>
            {/* Header */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50/50 transition-colors rounded-t-xl"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
                        <Key className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">Environment Variables</h3>
                        <p className="text-sm text-slate-500">
                            {envVars.length === 0
                                ? "Set secrets and configuration for your app"
                                : `${envVars.length} variable${envVars.length > 1 ? "s" : ""} configured`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {envVars.length > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
                            {envVars.length}
                        </span>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                </div>
            </button>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 pt-0 space-y-4">
                    {/* Variables List */}
                    {envVars.length > 0 && (
                        <div className="space-y-3">
                            {envVars.map((envVar, index) => (
                                <div
                                    key={index}
                                    className="group flex items-start gap-3 p-3 rounded-lg bg-slate-900 border border-slate-700 shadow-sm"
                                >
                                    {/* Key Input */}
                                    <div className="flex-1 min-w-0">
                                        <Input
                                            value={envVar.key}
                                            onChange={(e) => updateVariable(index, "key", e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                                            placeholder="VARIABLE_NAME"
                                            className="font-mono text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
                                        />
                                    </div>

                                    {/* Value Input */}
                                    <div className="flex-[2] min-w-0 relative">
                                        <Input
                                            type={envVar.isSecret && !showSecrets.has(index) ? "password" : "text"}
                                            value={envVar.value}
                                            onChange={(e) => updateVariable(index, "value", e.target.value)}
                                            placeholder="value"
                                            className="font-mono text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 pr-20"
                                        />
                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            {/* Toggle visibility */}
                                            <button
                                                type="button"
                                                onClick={() => toggleSecret(index)}
                                                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                                                title={showSecrets.has(index) ? "Hide value" : "Show value"}
                                            >
                                                {showSecrets.has(index) ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        type="button"
                                        onClick={() => generateRandomValue(index)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-sm"
                                        title="Generate random secret"
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        Generate
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                        type="button"
                                        onClick={() => removeVariable(index)}
                                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                                        title="Remove variable"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addVariable}
                            className="gap-1.5 border-slate-300 hover:bg-slate-100"
                        >
                            <Plus className="h-4 w-4" />
                            Add Environment Variable
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="gap-1.5 border-slate-300 hover:bg-slate-100"
                        >
                            <FileText className="h-4 w-4" />
                            Add from .env
                        </Button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".env,.env.local,.env.development,.env.production,text/plain"
                            onChange={handleEnvFileUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Help Text */}
                    {envVars.length === 0 && (
                        <p className="text-xs text-slate-400 italic">
                            Environment variables are encrypted and only visible at runtime.
                            Use them for API keys, database URLs, and other secrets.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
