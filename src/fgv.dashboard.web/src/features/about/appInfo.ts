import { getJson } from '../../shared/api/httpClient';

export interface AppInfo {
    name: string;
    version: string;
    environment: string;
    serverTimeUtc: string;
}

export const fetchAppInfo = (signal?: AbortSignal) =>
    getJson<AppInfo>('/api/v1/app-info', signal);