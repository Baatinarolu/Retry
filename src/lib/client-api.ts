export async function apiJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  if (data === null) throw new Error("The server returned an invalid response");
  return data;
}

export function errorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof DOMException && error.name === "AbortError") return null;
  return error instanceof Error ? error.message : fallback;
}
