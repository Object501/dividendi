import { describe, expect, it } from "vitest";

import rawInstruments from "../config/instruments.json";
import { parseInstrumentConfig } from "./config";

describe("parseInstrumentConfig", () => {
	it("accepts the repository instrument catalog", () => {
		expect(parseInstrumentConfig(rawInstruments)).toEqual(rawInstruments);
	});

	it("rejects duplicate stocks", () => {
		expect(() =>
			parseInstrumentConfig({
				...rawInstruments,
				stocks: [rawInstruments.stocks[0], rawInstruments.stocks[0]],
			}),
		).toThrow("stocks 中存在重复标的");
	});

	it("rejects an unknown schema version", () => {
		expect(() =>
			parseInstrumentConfig({
				...rawInstruments,
				schemaVersion: 2,
			}),
		).toThrow("不支持的标的配置版本");
	});
});
