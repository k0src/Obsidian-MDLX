import { EvaluatedValue } from "./evaluator";
import { RuntimeError } from "./evaluator";

export type StdLibFunction = (
	args: EvaluatedValue[],
	line: number,
	column: number
) => EvaluatedValue;

export const STDLIB_FUNCTIONS: Map<string, StdLibFunction> = new Map();

export function isStdLibFunction(name: string): boolean {
	return STDLIB_FUNCTIONS.has(name);
}

export function getStdLibFunction(name: string): StdLibFunction | undefined {
	return STDLIB_FUNCTIONS.get(name);
}

function stdlib_len(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 1) {
		throw new RuntimeError(
			`@len() expects 1 argument, got ${args.length}`,
			line,
			column
		);
	}

	const value = args[0];

	if (Array.isArray(value.value)) {
		return {
			value: value.value.length,
			isMarkdown: true,
		};
	}

	if (typeof value.value === "string") {
		return {
			value: value.value.length,
			isMarkdown: true,
		};
	}

	throw new RuntimeError(
		`@len() expects a string or array, got ${typeof value.value}`,
		line,
		column
	);
}

STDLIB_FUNCTIONS.set("@len", stdlib_len);
