const defaultAssertionFuncs: IIncludeMatchContext['assertionFuncs'] = {};
let defaultMode: 'check' | 'assert' = 'check';

type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * Sets the default operation mode for all calls of `assertRealArrayInclude` and `assertRealInclude`
 * @param mode Whether the functions should operate in check or assertion mode
 * @param assertionFuncs The assertion functions to use when checking
 */
export function setDefaultMode(mode: 'check' | 'assert', assertionFuncs?: IIncludeMatchContext['assertionFuncs']) {
    switch (mode) {
        case 'check':
        case 'assert':
            defaultMode = mode;
            break;

        default:
            throw new Error(`Mode must be 'check' or 'assert', not: ${mode}`);
    }

    if (assertionFuncs) {
        for (const key of Object.keys(assertionFuncs)) {
            if (typeof assertionFuncs[key] === 'function') {
                defaultAssertionFuncs[key] = assertionFuncs[key];
            } else {
                throw new Error(`Assertion func for type ${key} must be a function`);
            }
        }
    }
}

/**
 * Asserts that an array deep includes the children
 * @param actual The actual array observed
 * @param expected The expected array
 * @param funcmode The mode for evaluating expected values that are functions. When `value` the function is treated as the value that is expected. When `matcher` the function is considered a test function and executed, with the first argument being the actual value. It should return true if the value matches expectation
 */
 export function assertRealArrayInclude<E, A = Array<E>>(actual: DeepPartial<A>, expected: Array<E>, ctx: IIncludeMatchContext = {}): boolean {
	ctx = initContextDefaults(ctx);
    return _assertRealArrayInclude(actual, expected, ctx.path, ctx);
}

/**
 * Asserts that an object deep includes the properties
 * @param actual The actual object observed
 * @param expected The expected object
 * @param funcmode The mode for evaluating expected values that are functions. When `value` the function is treated as the value that is expected. When `matcher` the function is considered a test function and executed, with the first argument being the actual value. It should return true if the value matches expectation
 */
 export function assertRealInclude<Expected, Actual = Expected>(actual: DeepPartial<Actual>, expected: Expected, ctx: IIncludeMatchContext = {}): boolean {
	ctx = initContextDefaults(ctx);
    return _assertRealInclude(actual, expected, ctx.path, ctx);
}


function loadDefaultAssertionFuncs() {
    if (defaultAssertionFuncs.fail && defaultAssertionFuncs.equal) {
        return;
    }

    try {
        const { assert } = require('chai');
        if (!defaultAssertionFuncs.fail) {
            defaultAssertionFuncs.fail = assert.fail;
        }

        if (!defaultAssertionFuncs.equal) {
            defaultAssertionFuncs.equal = assert.equal;
        }
    } catch (_) {
        defaultAssertionFuncs.fail = (m) => {
            throw new Error('Assertion Failed: ' + m);
        };

        defaultAssertionFuncs.equal = (e, a, m) => {
            if (typeof e === typeof a && e === a) {
                return true;
            }

            throw new Error('Equality Assertion Failed: ' + m);
        };
    }
}

export type ArgMatcherFunction<T> = (actual: T | undefined, ctx: IIncludeMatchContext) => boolean;

export interface IIncludeMatchContext {
    /**
     * Indicates the path to the current field within the object. Initialized internally.
     */
	path?: string;

    /**
     * Whether functions in the expected value represent values to be matched, or matcher functions to invoke.
     */
	funcmode?: 'matcher' | 'value';

    /**
     * Allows symbolic equality matchingf or the given symbols. See documentation.
     */
	symbols?: {[sym: symbol]: { matcher?: ArgMatcherFunction<any>, value?: any }};
    
    /**
     * Which mode to run the library in.
     * 
     * 'assert' mode will throw exceptions for any failed assertions.
     * 'check' mode will return a boolean indicating `true` for pass, and `false` for failure.
     */
    mode?: 'check' | 'assert';

    /**
     * Functions to be used to checking assertions. You can inject a custom function for your testing library, or just use the defaults.
     */
    assertionFuncs?: {
        fail?: (message: string) => void,
        equal?: (actual: any, expected: any, message: string) => void;
    };
}

function initContextDefaults(ctx: IIncludeMatchContext): IIncludeMatchContext {
    if (Object.keys(defaultAssertionFuncs).length === 0) {
        loadDefaultAssertionFuncs();
    }

	const newCtx: IIncludeMatchContext = {
		funcmode: 'value',
        mode: defaultMode,
        path: '$',
		...ctx,
		symbols: {},
        assertionFuncs: {
            ...defaultAssertionFuncs,
            ...ctx.assertionFuncs,
        }
	};

	if (ctx.symbols) {
		for (const sym of Reflect.ownKeys(ctx.symbols)) {
			newCtx.symbols[sym] = {
				matcher: (a: any) => typeof a !== 'undefined',
				value: undefined,
				...ctx.symbols[sym],
			};
		}
	}

	return newCtx;
}

function assertProperty(obj: object, property: string, message: string, ctx: IIncludeMatchContext) {
    if (typeof obj !== 'object') {
        throw new Error(`Internal Error: Expected object for property assertion but got ${typeof obj}`);
    }

    if (Object.keys(obj).find(n => n === property)) {
        return true;
    } else {
        ctx.assertionFuncs.fail(`Property Assertion Failed: Could not find property '${property}': ${message}`);
    }
}

function assertTrue(expectation: boolean, message: string, ctx: IIncludeMatchContext) {
    if (typeof expectation !== 'boolean' || expectation !== true) {
        ctx.assertionFuncs.fail('Truth Assertion Failed: ' + message);
    }

    return true;
}



function _assertRealInclude(actual: any, expected: any, path: string = '$', ctx: IIncludeMatchContext = {}): boolean {
    try {
		if (typeof actual !== 'object') {
			ctx.assertionFuncs.equal(actual, expected, `Property does not match expected value: ${path}`);
			return true;
		} else if (typeof expected !== 'object') {
			ctx.assertionFuncs.equal(actual, expected, `Property does not match expected value: ${path}`);
			return true;
		}

        const matchedKeys = new Set<string | symbol>();
        for (const expectedKey of [...Object.keys(expected), ...Object.getOwnPropertySymbols(expected)]) {
            let actualKey = expectedKey;
            const propPath = `${path}.${expectedKey.toString()}`;
            if (typeof expectedKey === 'symbol' && expectedKey in ctx.symbols) {
                const symval = ctx.symbols[expectedKey];
                if (!symval.matcher(symval.value, ctx)) {
                    // Symbol hasn't been assigned a value yet. Try and find a matching key
                    const foundkey = Object.keys(actual).find(v => !matchedKeys.has(v) && symval.matcher(v, ctx));
                    if (symval.matcher(foundkey, ctx)) {
                        symval.value = foundkey;
                    } else {
                        ctx.assertionFuncs.fail(`Could not resolve property ${propPath}`);
                    }
                } else {
                    // Symbol has resolved a value, try and find it
                    assertProperty(actual, symval.value, `Expected resolved symbol ${propPath} as key (resolved to value ${symval.value})`, ctx);
                }

                actualKey = symval.value;
            } else {
                assertProperty(actual, expectedKey as any, `Expected property ${propPath}`, ctx);
            }

            const expectedVal = expected[expectedKey];
            if (typeof expectedVal === 'object') {
                if (Array.isArray(expectedVal)) {
                    _assertRealArrayInclude(actual[actualKey], expectedVal, propPath, { ...ctx, mode: 'assert' });
                } else {
                    _assertRealInclude(actual[actualKey], expectedVal, propPath, { ...ctx, mode: 'assert' })
                }
            } else if (typeof expectedVal === 'function' && ctx.funcmode === 'matcher') {
                assertTrue(expectedVal(actual[actualKey], ctx), `Matcher function did not match expected value "${expectedVal}" at ${path}`, ctx);
            } else if (typeof expectedVal === 'symbol' && expectedVal in ctx.symbols) {
                const symval = ctx.symbols[expectedKey];
                if (!symval.matcher(symval.value, ctx)) {
                    // Symbol hasn't been assigned a value yet. Try and find a matching key
                    if (symval.matcher(actual[actualKey], ctx)) {
                        symval.value = actual[actualKey];
                    } else {
                        ctx.assertionFuncs.fail(`Property did not pass symbol ${expectedVal.toString()} matcher ${propPath}`);
                    }
                } else {
                    // Symbol has resolved a value, check it
                    ctx.assertionFuncs.equal(actual[actualKey], symval.value, `Property symbol ${propPath} did not match expected value ${symval.value}`);
                }
            } else {
                ctx.assertionFuncs.equal(actual[actualKey], expectedVal, `Property does not match expected value: ${propPath}`);
            }

            matchedKeys.add(actualKey);
        }
    } catch (e) {
        if (ctx.mode === 'assert') {
            throw e;
        }

        return false;
    }

    return true;
}

function _assertRealArrayInclude(actual: any, expected: Array<any>, path: string = '$', ctx: IIncludeMatchContext = {}): boolean {
    try {
        const skipActuals = new Set<any>();
        for (const expectedIndex in expected) {
            const expectedVal = expected[expectedIndex];
            const expectedType = typeof expectedVal;
            const expectedPath = `${path}.${expectedIndex}`;
            let found = false;
            for (const actualIndex in actual) {
                if (skipActuals.has(actualIndex)) {
                    continue;
                }

                if (expectedType === 'function' && ctx.funcmode === 'matcher') {
                    if (expectedVal(actual[actualIndex], ctx)) {
                        skipActuals.add(actualIndex);
                        found = true;
                        break;
                    }
                }

                if (expectedType === 'symbol' && expectedVal in ctx.symbols) {
                    const symval = ctx.symbols[expectedVal];
                    if (!symval.matcher(symval.value, ctx)) {
                        // Symbol hasn't been assigned a value yet. Try and find a matching key
                        if (symval.matcher(actual[actualIndex], ctx)) {
                            symval.value = actual[actualIndex];
                        } else {
                            ctx.assertionFuncs.fail(`Property did not pass symbol ${expectedVal.toString()} matcher ${expectedPath}`);
                        }
                    } else {
                        // Symbol has resolved a value, check it
                        ctx.assertionFuncs.equal(actual[actualIndex], symval.value, `Property symbol ${expectedPath} did not match expected value ${symval.value}`);
                    }

                    skipActuals.add(actualIndex);
                    found = true;
                    break;
                }
                
                if (typeof actual[actualIndex] !== expectedType) {
                    continue;
                }

                if (expectedType === 'object') {
                    try {
                        if (Array.isArray(expectedVal)) {
                            found = _assertRealArrayInclude(actual[actualIndex], expectedVal, expectedPath, ctx);
                        } else {
                            found = _assertRealInclude(actual[actualIndex], expectedVal, expectedPath, ctx);
                        }

                        skipActuals.add(actualIndex);
                        if (found) {
                            break;
                        }
                    } catch (e) {
                        // Do nothing
                    }
                } else if (expectedVal === actual[actualIndex]) {
                    skipActuals.add(actualIndex);
                    found = true;
                    break;
                }
            }

            if (!found) {
                ctx.assertionFuncs.fail(`Could not find array member value at path: ${expectedPath}`);
            }
        }
    } catch (e) {
        if (ctx.mode === 'assert') {
            throw e;
        }

        return false;
    }

    return true;
}