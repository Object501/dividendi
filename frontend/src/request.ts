type Fetcher = typeof fetch;

export interface JsonRequestOptions {
	readonly cache?: RequestCache;
	readonly fetcher?: Fetcher | undefined;
	readonly signal?: AbortSignal | undefined;
	readonly timeoutMs?: number;
}

class HttpStatusError extends Error {
	readonly retryable: boolean;

	constructor(label: string, status: number) {
		super(`${label}请求失败：${status}`);
		this.retryable = status === 429 || status >= 500;
	}
}

function requestSignal(
	parent: AbortSignal | undefined,
	timeoutMs: number,
): { readonly cleanup: () => void; readonly signal: AbortSignal } {
	const controller = new AbortController();
	const abort = () => controller.abort(parent?.reason);
	if (parent?.aborted === true) {
		abort();
	} else {
		parent?.addEventListener("abort", abort, { once: true });
	}
	const timeout = globalThis.setTimeout(
		() => controller.abort(new DOMException("请求超时", "TimeoutError")),
		timeoutMs,
	);
	return {
		cleanup: () => {
			globalThis.clearTimeout(timeout);
			parent?.removeEventListener("abort", abort);
		},
		signal: controller.signal,
	};
}

export async function fetchJson(
	url: string,
	label: string,
	options: JsonRequestOptions = {},
): Promise<unknown> {
	const {
		cache = "no-store",
		fetcher = fetch,
		signal: parentSignal,
		timeoutMs = 15_000,
	} = options;
	let failure: unknown = new Error(`${label}请求失败`);
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const attemptSignal = requestSignal(parentSignal, timeoutMs);
		try {
			const response = await fetcher(url, {
				cache,
				signal: attemptSignal.signal,
			});
			if (!response.ok) {
				throw new HttpStatusError(label, response.status);
			}
			return await response.json();
		} catch (error) {
			failure = error;
			if (
				parentSignal?.aborted === true ||
				(error instanceof HttpStatusError && !error.retryable) ||
				attempt === 1
			) {
				throw error;
			}
			await new Promise((resolve) =>
				setTimeout(resolve, 250 + Math.random() * 500),
			);
		} finally {
			attemptSignal.cleanup();
		}
	}
	throw failure;
}
