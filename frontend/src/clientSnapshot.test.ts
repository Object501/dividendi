import { describe, expect, it } from "vitest";
import fixture from "../../collector/tests/fixtures/snapshot.json";
import { loadClientSnapshot, saveClientSnapshot } from "./clientSnapshot";
import { instruments } from "./config";
import { parseLatestData } from "./data";

class MemoryStorage {
	private readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe("客户端行情快照", () => {
	it("往返保存经过完整校验的最新计算结果", () => {
		const storage = new MemoryStorage();
		const latest = parseLatestData(fixture, instruments);

		saveClientSnapshot(storage, latest);

		expect(loadClientSnapshot(storage, instruments)).toEqual(latest);
	});

	it("删除无法通过当前配置和 Schema 的旧缓存", () => {
		const storage = new MemoryStorage();
		storage.setItem("dividendi:latest:v1", '{"schemaVersion":0}');

		expect(loadClientSnapshot(storage, instruments)).toBeNull();
		expect(storage.getItem("dividendi:latest:v1")).toBeNull();
	});
});
