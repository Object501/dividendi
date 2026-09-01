import assert from "node:assert/strict";
import test from "node:test";

import { createScheduler, dispatchHistoryUpdate } from "../src/index.js";

test("dispatches the history workflow with the Cloudflare source", async () => {
	let capturedUrl;
	let capturedOptions;
	const request = async (url, options) => {
		capturedUrl = url;
		capturedOptions = options;
		return new Response(null, { status: 204 });
	};

	await dispatchHistoryUpdate("test-token", request);

	assert.equal(
		capturedUrl,
		"https://api.github.com/repos/Object501/dividendi/actions/workflows/update-data.yml/dispatches",
	);
	assert.equal(capturedOptions.method, "POST");
	assert.equal(capturedOptions.headers.Authorization, "Bearer test-token");
	assert.deepEqual(JSON.parse(capturedOptions.body), {
		ref: "main",
		inputs: { source: "cloudflare" },
	});
});

test("rejects a missing GitHub token before making a request", async () => {
	let requested = false;

	await assert.rejects(
		dispatchHistoryUpdate("", async () => {
			requested = true;
		}),
		/GITHUB_TOKEN secret is missing/,
	);
	assert.equal(requested, false);
});

test("reports a rejected GitHub dispatch", async () => {
	await assert.rejects(
		dispatchHistoryUpdate(
			"test-token",
			async () =>
				new Response('{"message":"Bad credentials"}', { status: 401 }),
		),
		/GitHub workflow dispatch failed with HTTP 401:.*Bad credentials/,
	);
});

test("scheduled handler reads the token from its environment", async () => {
	let authorization;
	const scheduler = createScheduler(async (_url, options) => {
		authorization = options.headers.Authorization;
		return new Response(null, { status: 204 });
	});

	await scheduler.scheduled({}, { GITHUB_TOKEN: "worker-secret" });

	assert.equal(authorization, "Bearer worker-secret");
});
