import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJson } from "./request";

afterEach(() => {
	vi.useRealTimers();
});

describe("JSON request", () => {
	it("does not retry a permanent client error", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 404 }));

		await expect(
			fetchJson("https://example.test/data", "测试", { fetcher }),
		).rejects.toThrow("测试请求失败：404");
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it("retries a transient server error", async () => {
		vi.useFakeTimers();
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(Response.json({ ok: true }));

		const request = fetchJson("https://example.test/data", "测试", { fetcher });
		await vi.runAllTimersAsync();

		await expect(request).resolves.toEqual({ ok: true });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
