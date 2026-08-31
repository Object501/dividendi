import type { PublicDataValidator } from "./generated/publicDataValidators.js";

function validationPath(documentName: string, instancePath: string): string {
	return `${documentName}${instancePath.replaceAll("/", ".")}`;
}

export function assertStructure(
	value: unknown,
	validator: PublicDataValidator,
	documentName: string,
): void {
	if (validator(value)) {
		return;
	}
	const error = validator.errors?.[0];
	const path = validationPath(documentName, error?.instancePath ?? "");
	throw new Error(
		`${path} 不符合 public-data-v1 JSON Schema${error?.message === undefined ? "" : `：${error.message}`}`,
	);
}
