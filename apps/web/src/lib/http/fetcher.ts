export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

export async function fetcher<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorPayload: ApiErrorPayload =
      isJson && typeof payload === "object" && payload && "error" in payload
        ? (payload.error as ApiErrorPayload)
        : {
            code: "HTTP_ERROR",
            message: typeof payload === "string" && payload ? payload : response.statusText
          };

    throw new ApiClientError(response.status, errorPayload);
  }

  if (!isJson || typeof payload !== "object" || !payload || !("data" in payload)) {
    throw new ApiClientError(500, {
      code: "INVALID_RESPONSE",
      message: "Expected JSON response with data field",
      details: payload
    });
  }

  return (payload as ApiResponse<T>).data;
}
