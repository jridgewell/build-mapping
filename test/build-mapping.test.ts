import { strict as assert } from 'assert';
import { build, normalize, type BuiltCode } from '../src/build-mapping';
import {
  AnyMap,
  originalPositionFor,
  TraceMap,
  decodedMap,
  type SectionedSourceMapInput,
  encodedMap,
} from '@jridgewell/trace-mapping';

describe('BuildMapping', () => {
  const builtCode = {
    code: 'foo',
    map: {
      version: 3,
      names: [],
      sources: ['foo.js'],
      mappings: 'AAAA',
    },
  } satisfies BuiltCode;
  const EMPTY_MAP = {
    version: 3,
    names: [],
    sources: [],
    mappings: [],
  };

  describe('build', () => {
    it('builds sourceless code', () => {
      const built = build`
      foo
    `;

      assert.equal(built.code, '\n      foo\n    ');
      assert.deepEqual(built.map, { version: 3, sections: [] });
    });

    it('builds sourced code', () => {
      const built = build`${builtCode}`;

      assert.equal(built.code, 'foo');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [{ offset: { line: 0, column: 0 }, map: builtCode.map }],
      });
    });

    it('combines sourceless code', () => {
      const built = build`
      ${'foo'}${'bar'} ${'baz'}
    `;

      assert.equal(built.code, '\n      foobar baz\n    ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [],
      });
    });

    it('combines sourced code', () => {
      const built = build`
      ${builtCode}${builtCode} ${builtCode}
    `;

      assert.equal(built.code, '\n      foofoo foo\n    ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [
          { offset: { line: 1, column: 6 }, map: builtCode.map },
          { offset: { line: 1, column: 9 }, map: builtCode.map },
          { offset: { line: 1, column: 12 }, map: EMPTY_MAP },
          { offset: { line: 1, column: 13 }, map: builtCode.map },
          { offset: { line: 1, column: 16 }, map: EMPTY_MAP },
        ],
      });
    });

    it('combines sourceless and sourced code', () => {
      const built = build`
      bar
      ${builtCode}
      baz
    `;

      assert.equal(built.code, '\n      bar\n      foo\n      baz\n    ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [
          { offset: { line: 2, column: 6 }, map: builtCode.map },
          { offset: { line: 2, column: 9 }, map: EMPTY_MAP },
        ],
      });
    });

    it('input to AnyMap', () => {
      const { map } = build`
      ${builtCode}
    `;

      const tracer = AnyMap(map);

      assert.deepEqual(originalPositionFor(tracer, { line: 2, column: 6 }), {
        source: 'foo.js',
        line: 1,
        column: 0,
        name: null,
      });
    });
  });

  describe('normalize', () => {
    const tracer = new TraceMap(builtCode.map);
    const map: SectionedSourceMapInput = {
      version: 3,
      sections: [
        { offset: { line: 1, column: 1 }, map: builtCode.map },
        { offset: { line: 2, column: 1 }, map: JSON.stringify(builtCode.map) },
        {
          offset: { line: 3, column: 1 },
          map: {
            version: 3,
            sections: [
              { offset: { line: 1, column: 1 }, map: tracer },
              { offset: { line: 2, column: 1 }, map: decodedMap(tracer) as any },
            ],
          },
        },
      ],
    };

    const normalized = encodedMap(tracer);
    assert.deepEqual(normalize({ code: 'code', map }), {
      code: 'code',
      map: {
        version: 3,
        file: undefined,
        sections: [
          { offset: { line: 1, column: 1 }, map: normalized },
          { offset: { line: 2, column: 1 }, map: normalized },
          {
            offset: { line: 3, column: 1 },
            map: {
              version: 3,
              file: undefined,
              sections: [
                { offset: { line: 1, column: 1 }, map: normalized },
                { offset: { line: 2, column: 1 }, map: normalized },
              ],
            },
          },
        ],
      },
    });
  });
});
