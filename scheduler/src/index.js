const DISPATCH_URL =
	"https://api.github.com/repos/Object501/dividendi/actions/workflows/update-data.yml/dispatches";

export async function dispatchHistoryUpdate(token, request = fetch) {
	if (typeof token !== "string" || token.length === 0) {
		throw new Error("GITHUB_TOKEN secret is missing");
	}

	const response = await request(DISPATCH_URL, {
		method: "POST",
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"User-Agent": "dividendi-cloudflare-scheduler",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		body: JSON.stringify({
			ref: "main",
			inputs: { source: "cloudflare" },
		}),
	});

	if (response.status !== 204) {
		const detail = (await response.text()).slice(0, 512);
		throw new Error(
			`GitHub workflow dispatch failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
		);
	}
}

export function createScheduler(request = fetch) {
	return {
		async scheduled(_controller, environment) {
			await dispatchHistoryUpdate(environment.GITHUB_TOKEN, request);
		},
	};
}

export default createScheduler();
