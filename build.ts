export type BuildInput = {
  source: string;
  loader?: "js" | "jsx" | "ts" | "tsx";
  dependencies?: Record<string, string>;
  types?: string;
};

export type TransformOptions = {
  target?:
    | "deno"
    | "denonext"
    | "node"
    | "esnext"
    | `es201${5 | 6 | 7 | 8 | 9}`
    | `es202${0 | 1 | 2}`;
  imports?: Record<string, string>;
};

export type BuildOutput = {
  id: string;
  url: string;
  bundleUrl: string;
};

const MiB = 10 << 20;

async function fetchApi(
  endpoint: string,
  options: Record<string, any>,
): Promise<any> {
  const apiName = endpoint.slice(1);
  if (options.source.length > MiB) {
    throw new Error(`esm.sh [${apiName}] <400> source exceeded limit.`);
  }
  const body = JSON.stringify(options);
  if (body.length > 2 * MiB) {
    throw new Error(`esm.sh [${apiName}] <400> body exceeded limit.`);
  }
  const res = await fetch(new URL(endpoint, import.meta.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `esm.sh [${apiName}] <${res.status}> ${res.statusText}`,
    );
  }
  const ret = await res.json();
  if (ret.error) {
    throw new Error(
      `esm.sh [${apiName}] ${ret.error.message}`,
    );
  }
  return ret;
}

export function build(input: string | BuildInput): Promise<BuildOutput> {
  const options = typeof input === "string" ? { source: input } : input;
  if (!options.source) {
    throw new Error("esm.sh [build] <400> missing source");
  }
  return fetchApi("/build", options);
}

export function transform(
  input: string | (BuildInput & TransformOptions),
): Promise<{ code: string }> {
  const options = typeof input === "string" ? { source: input } : input;
  if (!options.source) {
    throw new Error("esm.sh [transform] <400> missing source");
  }
  Reflect.set(options, "imports", JSON.stringify(options.imports || {}));
  return fetchApi("/transform", options);
}

export async function esm<T extends object = Record<string, any>>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T & { _build: BuildOutput }> {
  const source = String.raw({ raw: strings }, ...values);
  const ret = await buildWithCache(source);
  const mod: T = await import(ret.url);
  return {
    ...mod,
    _build: ret,
  };
}

async function buildWithCache(
  input: string | BuildInput,
): Promise<BuildOutput> {
  const key = await computeHash(
    typeof input === "string" ? input : JSON.stringify(input),
  );
  if (globalThis.localStorage) {
    const cached = localStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached);
    }
  }
  const ret = await build(input);
  if (globalThis.localStorage) {
    localStorage.setItem(key, JSON.stringify(ret));
  }
  return ret;
}

async function computeHash(input: string): Promise<string> {
  const buffer = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(input),
    ),
  );
  return [...buffer].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default build;
