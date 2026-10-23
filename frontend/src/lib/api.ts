import { resolveServerUrl } from './serverUrl';

const API_URL = resolveServerUrl(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api');

export { API_URL };

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

export type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? 'Request failed');
  }

  return payload as T;
};

export const apiData = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const payload = await apiRequest<ApiResponse<T>>(path, options);
  return payload.data as T;
};
