const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApiError {
    message: string;
    code?: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private getToken(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem("token");
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = this.getToken();
        const headers: HeadersInit = {
            ...(options.body && { "Content-Type": "application/json" }),
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        };

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error: ApiError = await response.json().catch(() => ({
                message: `Request failed with status ${response.status}`,
            }));
            throw new Error(error.message);
        }

        return response.json();
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "GET" });
    }

    async post<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "POST",
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async put<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PUT",
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE" });
    }

    async patch<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PATCH",
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    // Auth
    async login(email: string, password: string) {
        return this.post<{ token: string; user: User }>("/auth/login", {
            email,
            password,
        });
    }

    async register(email: string, password: string, name: string) {
        return this.post<{ token: string; user: User }>("/auth/register", {
            email,
            password,
            name,
        });
    }

    async getMe() {
        return this.get<User>("/auth/me");
    }

    // Servers
    async getServers() {
        return this.get<Server[]>("/servers");
    }

    async getServer(id: string) {
        return this.get<Server>(`/servers/${id}`);
    }

    async createServer(data: { name: string; ip: string }) {
        return this.post<Server>("/servers", data);
    }

    async deleteServer(id: string) {
        return this.delete<void>(`/servers/${id}`);
    }

    async getConnectCommand(serverId: string) {
        return this.get<{ command: string }>(`/servers/${serverId}/connect-command`);
    }

    // Apps
    async getApps(serverId: string) {
        return this.get<App[]>(`/servers/${serverId}/apps`);
    }

    async createApp(serverId: string, data: CreateAppInput) {
        return this.post<App>(`/servers/${serverId}/apps`, data);
    }

    async deleteApp(serverId: string, appId: string) {
        return this.delete<void>(`/servers/${serverId}/apps/${appId}`);
    }

    async uploadApp(serverId: string, data: { name: string; domain?: string; filename: string; fileData: string; envVars?: Record<string, string> }) {
        return this.post<App>(`/servers/${serverId}/apps/upload`, data);
    }

    async updateAppEnvVars(serverId: string, appId: string, envVars: Record<string, string>) {
        return this.patch<{ id: string; name: string; envVars: Record<string, string>; message: string }>(`/servers/${serverId}/apps/${appId}`, { envVars });
    }

    async deployApp(serverId: string, appId: string) {
        return this.post<App>(`/servers/${serverId}/apps/${appId}/deploy`, {});
    }

    async stopApp(serverId: string, appId: string) {
        return this.post<App>(`/servers/${serverId}/apps/${appId}/stop`, {});
    }

    async getAppLogs(serverId: string, appId: string) {
        return this.get<{ id: string; name: string; logs: string; deployedAt?: string; status: string }>(
            `/servers/${serverId}/apps/${appId}/logs`
        );
    }

    // Databases
    async getDatabases(serverId: string) {
        return this.get<Database[]>(`/servers/${serverId}/databases`);
    }

    async createDatabase(serverId: string, data: CreateDatabaseInput) {
        return this.post<Database>(`/servers/${serverId}/databases`, data);
    }

    async getDatabase(serverId: string, dbId: string) {
        return this.get<Database>(`/servers/${serverId}/databases/${dbId}`);
    }

    async deleteDatabase(serverId: string, dbId: string) {
        return this.delete<void>(`/servers/${serverId}/databases/${dbId}`);
    }

    async startDatabase(serverId: string, dbId: string) {
        return this.post<{ message: string }>(`/servers/${serverId}/databases/${dbId}/start`, {});
    }

    async stopDatabase(serverId: string, dbId: string) {
        return this.post<{ message: string }>(`/servers/${serverId}/databases/${dbId}/stop`, {});
    }

    async getDbPassword(serverId: string, dbId: string) {
        return this.get<{ password: string }>(`/servers/${serverId}/databases/${dbId}/password`);
    }

    async testDatabase(serverId: string, dbId: string) {
        return this.post<{ message: string }>(`/servers/${serverId}/databases/${dbId}/test`, {});
    }

    async setDbReadOnly(serverId: string, dbId: string, readOnly: boolean) {
        return this.patch<{ readOnly: boolean; message: string }>(`/servers/${serverId}/databases/${dbId}/readonly`, { readOnly });
    }

    async seedDatabase(serverId: string, dbId: string) {
        return this.post<{ message: string; jobId: string }>(`/servers/${serverId}/databases/${dbId}/seed`, {});
    }
}

export const api = new ApiClient(API_BASE_URL);

// Types
export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: string;
}

export interface Server {
    id: string;
    name: string;
    ip: string;
    hostname?: string;
    os?: string;
    arch?: string;
    status: "pending" | "connected" | "disconnected" | "error" | "PENDING" | "CONNECTED" | "DISCONNECTED" | "UNCLAIMED";
    // TRUTH: Real-time agent connection status from WebSocket Map
    isLiveConnected?: boolean;
    agentVersion?: string;
    connectedAt?: string;
    lastSeenAt?: string;
    createdAt: string;
}

export interface App {
    id: string;
    name: string;
    domain?: string;
    status: "deploying" | "running" | "stopped" | "error" | "pending" | "DEPLOYING" | "RUNNING" | "STOPPED" | "ERROR" | "PENDING";
    gitUrl?: string;
    branch?: string;
    port?: number | null;
    envVars?: Record<string, string> | null;
    createdAt: string;
}

export interface Database {
    id: string;
    name: string;
    type: "postgresql" | "mysql" | "mongodb" | "redis";
    status: "pending" | "creating" | "running" | "stopped" | "error" | "PENDING" | "CREATING" | "RUNNING" | "STOPPED" | "ERROR";
    port?: number | null;
    hostPort?: number | null;
    username?: string;
    exposure?: "internal" | "public";
    readOnly?: boolean;
    cpuLimit?: number;
    memoryLimit?: number;
    createdAt: string;
}

export interface CreateAppInput {
    name: string;
    gitUrl?: string;
    branch?: string;
    domain?: string;
    envVars?: Record<string, string>;
}

export interface CreateDatabaseInput {
    name: string;
    type: "postgresql" | "mysql" | "mongodb" | "redis";
    exposure?: "internal" | "public";
}
