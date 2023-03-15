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
            
            (mode) => assertRealArrayInclude(['a'], ['b'], { mode }),
        
            (mode) => assertRealArrayInclude(['a', 'c'], ['b'], { mode }),

            (mode) => assertRealArrayInclude(['a', 'c'], ['b', 'a'], { mode }),
        
            (mode) => assertRealArrayInclude<any>(['1'], [1], { mode }),

            (mode) => assertRealArrayInclude<any>([['a']], ['a'], { mode }),
        
            (mode) => assertRealArrayInclude<any>(['a'], [['a']], { mode }),

            (mode) => assertRealArrayInclude([() => false], [() => false], { mode }),
        ], 'throw');
    });

    it('[array] should pass when simple values are found', () => {
        const tstFunc = () => false;

        testBothModesMulti([
            (mode) => assertRealArrayInclude<any>(['a'], [], { mode }),

            (mode) => assertRealArrayInclude(['a'], ['a'], { mode }),

            (mode) => assertRealArrayInclude(['a', 'c'], ['a'], { mode }),

            (mode) => assertRealArrayInclude(['a', 'c'], ['c'], { mode }),

            (mode) => assertRealArrayInclude(['a', 'c'], ['a', 'c'], { mode }),
            (mode) => assertRealArrayInclude(['a', 'c'], ['c', 'a'], { mode }),
            (mode) => assertRealArrayInclude([1], [1], { mode }),

            (mode) => assertRealArrayInclude([['a']], [['a']], { mode }),

            (mode) => assertRealArrayInclude([tstFunc], [tstFunc], { mode }),
        ], 'no-throw');
    });

    it('[obj] should fail when simple values arent found', () => {
        testBothModesMulti([
            (mode) => assertRealInclude<any>({'a': 'a'}, {'a': 'b'}, { mode }),
            (mode) => assertRealInclude<any>({'b': 'a'}, {'a': 'b'}, { mode }),
        ], 'throw');
    });

    it('[obj] should pass when simple values are found', () => {
        testBothModesMulti([
            (mode) => assertRealInclude({'a': 'a'}, {'a': 'a'}, { mode }),
            (mode) => assertRealInclude({'a': 'a', 'b': 'a'}, {'a': 'a', 'b': 'a'}, { mode }),
        ], 'no-throw');
    });

    it('should find objects nested in arrays', () => {
        testBothModes(mode => assertRealArrayInclude<any>(
            [ { 'a': 'a' }, { 'b': 'b' }  ], 
            [ { 'a': 'a' } ],
            { mode }),
            'no-throw');

        testBothModes(mode => assertRealArrayInclude<any>(
            [ { 'a': 'a' }, { 'b': 'b' } ], 
            [ { 'b': 'b' } ],
            { mode }),
            'no-throw');

        testBothModes(mode => assertRealArrayInclude<any>(
            [ 'b', { 'b': 'b' }, { 'a': 'a' } ],
            [ { 'a': 'a' }, 'b' ], 
            { mode }),
            'no-throw');

        testBothModes(mode => assertRealArrayInclude<any>(
            [ { 'c': 'c' } ], 
            [ { 'b': 'b' }, { 'a': 'a' } ],
            { mode }),
            'throw');
    });

    it('should support matching functions', () => {
        const tstFunc = (test: string) => test.startsWith('abcd');
        testBothModes(mode => assertRealInclude(
            { 'myval': 'abcdefg' },
            { 'myval': tstFunc },
            { funcmode: 'matcher', mode }),
            'no-throw');

        testBothModes(mode => assertRealInclude(
            { 'myval': 'defg' },
            { 'myval': tstFunc },
            { funcmode: 'matcher', mode }),
            'throw');

        testBothModes(mode => assertRealArrayInclude(
            [ 'myval', 'abcdefg' ],
            [ tstFunc ],
            { funcmode: 'matcher', mode }),
            'no-throw');

        testBothModes(mode => assertRealArrayInclude(
            [ 'myval', 'defg' ],
            [ tstFunc ],
            { funcmode: 'matcher', mode }),
            'throw');
    });

    it('should support symbolic checking', () => {
        const sym = Symbol('a');
        testBothModes(mode => assertRealArrayInclude<any>(
            [ 'a', { 'a': 'b', 'bde': 'a' }, 'e', 'a', ],
            [ sym, { [sym]: 'b', 'bde': 'a' } ],
            { mode, symbols: {
                [sym]: { }
            }}
        ), 'no-throw');

        testBothModes(mode => assertRealArrayInclude<any>(
            [ 'a', { 'b': 'a'} ],
            [ sym, { [sym]: 'b' }, ],
            { mode, symbols: {
                [sym]: { }
            }}
        ), 'throw');

        testBothModes(mode => assertRealArrayInclude<any>(
            [ 'abc', { 'abc': 'b'} ],
            [ sym, { [sym]: 'b' }, ],
            { mode, symbols: {
                [sym]: { matcher: v => !!v?.startsWith('a') }
            }}
        ), 'no-throw');

        testBothModes(mode => assertRealArrayInclude<any>(
            [ 'bc', { 'bc': 'b'} ],
            [ sym, { [sym]: 'b' }, ],
            { mode, symbols: {
                [sym]: { matcher: v => !!v?.startsWith('a') }
            }}
        ), 'throw');
    });
});