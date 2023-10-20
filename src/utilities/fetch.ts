import type { ReadableStream } from "stream/web";

type Options = Partial<{
  method: "GET" | "POST" | "HEAD" | "PATCH";
  headers: Record<"Cookies" | string, string>;
  body: string | Blob | ArrayBuffer | URLSearchParams;
  mode: "same-origin" | "no-cors" | "cors" | "navigate" | "websocket";
}>;
type FetchResult = {
  json(): Promise<object>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  body: ReadableStream;
  status: number;
  statusText: "OK" | never;
  redirected: boolean;
  url: string;
};
type Fetch = (url: string, options?: Options) => Promise<FetchResult>;

export const fetch: Fetch = (globalThis as any).fetch;
