/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { instruments } from "./config";
import { parseHistoryData } from "./data";

const dataDirectory = process.env.DIVIDENDI_CONTRACT_DATA_DIR;

function readPublishedData(filename: string): unknown {
	if (dataDirectory === undefined) {
		throw new Error("DIVIDENDI_CONTRACT_DATA_DIR 未设置");
	}
	return JSON.parse(readFileSync(resolve(dataDirectory, filename), "utf-8"));
}

describe.skipIf(dataDirectory === undefined)(
	"published data frontend contract",
	() => {
		it("parses the exact history.json selected for publication", () => {
			expect(
				parseHistoryData(readPublishedData("history.json"), instruments),
			).toBeDefined();
		});
	},
);
