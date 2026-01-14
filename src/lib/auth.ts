import { api, User } from "./api";

const TOKEN_KEY = "token";

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

export async function login(
    email: string,
    password: string
): Promise<{ token: string; user: User }> {
    const result = await api.login(email, password);
    setToken(result.token);
    return result;
}

export async function register(
    email: string,
    password: string,
    name: string
): Promise<{ token: string; user: User }> {
    const result = await api.register(email, password, name);
    setToken(result.token);
    return result;
}

export function logout(): void {
    removeToken();
    window.location.href = "/login";
}
