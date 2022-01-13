import 'mocha';
import { assert } from 'chai';
import {
    assertRealArrayInclude,
    assertRealInclude,
    setDefaultMode,
} from '../src';

type TestFunc = (mode: 'assert' | 'check') => boolean;

function testBothModes(testFunc: TestFunc, mode: 'throw' | 'no-throw') {
    if (mode === 'throw') {
        assert.throws(() => {
            testFunc('assert');
        });

        assert.isFalse(testFunc('check'));
    } else {
        assert.doesNotThrow(() => {
            testFunc('assert');
        });

        assert.isTrue(testFunc('check'));
    }
}

function testBothModesMulti(tests: TestFunc[], mode: 'throw' | 'no-throw') {
    for (const t of tests) {
        testBothModes(t, mode);
    }
}

describe('TestRealInclude', () => {
    it('[array] should fail when simple values arent found', () => {
        testBothModesMulti([
            
            (mode) => assertRealArrayInclude(['a'], ['b'], undefined, { mode }),
        
            (mode) => assertRealArrayInclude(['a', 'c'], ['b'], undefined, { mode }),

            (mode) => assertRealArrayInclude(['a', 'c'], ['b', 'a'], undefined, { mode }),
        
            (mode) => assertRealArrayInclude(['1'], [1], undefined, { mode }),

            (mode) => assertRealArrayInclude([['a']], ['a'], undefined, { mode }),
        
            (mode) => assertRealArrayInclude(['a'], [['a']], undefined, { mode }),

            (mode) => assertRealArrayInclude([() => false], [() => false], undefined, { mode }),
        ], 'throw');
    });

    it('[array] should pass when simple values are found', () => {
        const tstFunc = () => false;

        testBothModesMulti([
            (mode) => assertRealArrayInclude(['a'], [], undefined, { mode }),

            (mode) => assertRealArrayInclude(['a'], ['a'], undefined, { mode }),

            (mode) => assertRealArrayInclude(['a', 'c'], ['a'], undefined, { mode }),

            (mode) => assertRealArrayInclude(['a', 'c'], ['c'], undefined, { mode }),

            (mode) => assertRealArrayInclude(['a', 'c'], ['a', 'c'], undefined, { mode }),
            (mode) => assertRealArrayInclude(['a', 'c'], ['c', 'a'], undefined, { mode }),
            (mode) => assertRealArrayInclude([1], [1], undefined, { mode }),

            (mode) => assertRealArrayInclude([['a']], [['a']], undefined, { mode }),

            (mode) => assertRealArrayInclude([tstFunc], [tstFunc], undefined, { mode }),
        ], 'no-throw');
    });

    it('[obj] should fail when simple values arent found', () => {
        testBothModesMulti([
            (mode) => assertRealInclude({'a': 'a'}, {'a': 'b'}, undefined, { mode }),
            (mode) => assertRealInclude({'b': 'a'}, {'a': 'b'}, undefined, { mode }),
        ], 'throw');
    });

    it('[obj] should pass when simple values are found', () => {
        testBothModesMulti([
            (mode) => assertRealInclude({'a': 'a'}, {'a': 'a'}, undefined, { mode }),
            (mode) => assertRealInclude({'a': 'a', 'b': 'a'}, {'a': 'a', 'b': 'a'}, undefined, { mode }),
        ], 'no-throw');
    });

    it('should find objects nested in arrays', () => {
        testBothModes(mode => assertRealArrayInclude(
            [ { 'a': 'a' }, { 'b': 'b' }  ], 
            [ { 'a': 'a' } ],
            undefined, 
            { mode }),
            'no-throw');

        testBothModes(mode => assertRealArrayInclude(
            [ { 'a': 'a' }, { 'b': 'b' } ], 
            [ { 'b': 'b' } ],
            undefined, 
            { mode }),
            'no-throw');

        testBothModes(mode => assertRealArrayInclude(
            [ 'b', { 'b': 'b' }, { 'a': 'a' } ],
            [ { 'a': 'a' }, 'b' ], 
            undefined, 
            { mode }),
            'no-throw');

        testBothModes(mode => assertRealArrayInclude(
            [ { 'c': 'c' } ], 
            [ { 'b': 'b' }, { 'a': 'a' } ],
            undefined, 
            { mode }),
            'throw');
    });

    it('should support matching functions', () => {
        const tstFunc = (test: string) => test.startsWith('abcd');
        testBothModes(mode => assertRealInclude(
            { 'myval': 'abcdefg' },
            { 'myval': tstFunc },
            undefined,
            { funcmode: 'matcher', mode }),
            'no-throw');

        testBothModes(mode => assertRealInclude(
            { 'myval': 'defg' },
            { 'myval': tstFunc },
            undefined,
            { funcmode: 'matcher', mode }),
            'throw');

        testBothModes(mode => assertRealArrayInclude(
            [ 'myval', 'abcdefg' ],
            [ tstFunc ],
            undefined,
            { funcmode: 'matcher', mode }),
            'no-throw');

        testBothModes(mode => assertRealArrayInclude(
            [ 'myval', 'defg' ],
            [ tstFunc ],
            undefined,
            { funcmode: 'matcher', mode }),
            'throw');
    });

    it('should support symbolic checking', () => {
        const sym = Symbol('a');
        testBothModes(mode => assertRealArrayInclude(
            [ 'a', { 'a': 'b', 'bde': 'a' }, 'e', 'a', ],
            [ sym, { [sym]: 'b', 'bde': 'a' }, sym ],
            undefined,
            { mode, symbols: {
                [sym]: { }
            }}
        ), 'no-throw');

        testBothModes(mode => assertRealArrayInclude(
            [ 'a', { 'b': 'a'} ],
            [ sym, { [sym]: 'b' }, ],
            undefined,
            { mode, symbols: {
                [sym]: { }
            }}
        ), 'throw');

        testBothModes(mode => assertRealArrayInclude(
            [ 'abc', { 'abc': 'b'} ],
            [ sym, { [sym]: 'b' }, ],
            undefined,
            { mode, symbols: {
                [sym]: { matcher: v => !!v?.startsWith('a') }
            }}
        ), 'no-throw');

        testBothModes(mode => assertRealArrayInclude(
            [ 'bc', { 'bc': 'b'} ],
            [ sym, { [sym]: 'b' }, ],
            undefined,
            { mode, symbols: {
                [sym]: { matcher: v => !!v?.startsWith('a') }
            }}
        ), 'throw');
    });
});