export class ApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(path, {
        headers: { Accept: 'application/json' },
        signal,
    });

    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
            const problem = await response.json();
            if (problem?.title) message = problem.title;
        } catch {
            // The error response had no JSON body; keep the generic message.
        }
        throw new ApiError(response.status, message);
    }

    return (await response.json()) as T;
}