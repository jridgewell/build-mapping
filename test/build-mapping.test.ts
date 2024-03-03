import { strict as assert } from 'assert';
import { build, normalizeMap, unnormalizedBuild } from '../src/build-mapping';
import {
  AnyMap,
  originalPositionFor,
  TraceMap,
  encodedMap,
  decodedMap,
} from '@jridgewell/trace-mapping';

describe('BuildMapping', () => {
  const builtCode = {
    code: 'foo',
    map: {
      version: 3 as const,
      names: [],
      sources: ['foo.js'],
      mappings: 'AAAA',
    },
  };
  const tracer = new TraceMap(builtCode.map);
  const normalizedBuiltMap = encodedMap(tracer);

  describe('build', () => {
    const emptyMap = {
      version: 3 as const,
      names: [],
      sources: [],
      mappings: [],
    };
    const normalizedEmptyMap = {
      ...emptyMap,
      mappings: '',
    };

    it('builds sourceless code', () => {
      const built = build`
        foo
      `;

      assert.equal(built.code, '\n        foo\n      ');
      assert.deepEqual(built.map, { version: 3, sections: [] });
    });

    it('builds sourced code', () => {
      const built = build`${builtCode}`;

      assert.equal(built.code, 'foo');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [{ offset: { line: 0, column: 0 }, map: normalizedBuiltMap }],
      });
    });

    it('combines sourceless code', () => {
      const built = build`
        ${'foo'}${'bar'} ${'baz'}
      `;

      assert.equal(built.code, '\n        foobar baz\n      ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [],
      });
    });

    it('combines sourced code', () => {
      const built = build`
        ${builtCode}${builtCode} ${builtCode}
      `;

      assert.equal(built.code, '\n        foofoo foo\n      ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [
          { offset: { line: 1, column: 8 }, map: normalizedBuiltMap },
          { offset: { line: 1, column: 11 }, map: normalizedBuiltMap },
          { offset: { line: 1, column: 14 }, map: normalizedEmptyMap },
          { offset: { line: 1, column: 15 }, map: normalizedBuiltMap },
          { offset: { line: 1, column: 18 }, map: normalizedEmptyMap },
        ],
      });
    });

    it('combines sourceless and sourced code', () => {
      const built = build`
        bar
        ${builtCode}
        baz
      `;

      assert.equal(built.code, '\n        bar\n        foo\n        baz\n      ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [
          { offset: { line: 2, column: 8 }, map: normalizedBuiltMap },
          { offset: { line: 2, column: 11 }, map: normalizedEmptyMap },
        ],
      });
    });

    it('input to AnyMap', () => {
      const { map } = build`
        ${builtCode}
      `;

      const tracer = AnyMap(map);

      assert.deepEqual(originalPositionFor(tracer, { line: 2, column: 8 }), {
        source: 'foo.js',
        line: 1,
        column: 0,
        name: null,
      });
    });

    it('normalizes SectionedSourceMapInput', () => {
      const built = build`
        ${builtCode}
        ${{ code: builtCode.code, map: JSON.stringify(builtCode.map) }}
        ${build`
          ${{ code: builtCode.code, map: tracer }}
          ${{ code: builtCode.code, map: decodedMap(tracer) as any }}
        `}
      `;
      const normalizedEmptyMap = encodedMap(new TraceMap(emptyMap));

      // @ts-expect-error output of build is already normalized
      const normalized = normalizeMap(built.map);
      assert.deepEqual(normalized, {
        version: 3,
        file: undefined,
        sections: [
          { offset: { line: 1, column: 8 }, map: normalizedBuiltMap },
          { offset: { line: 1, column: 11 }, map: normalizedEmptyMap },
          { offset: { line: 2, column: 8 }, map: normalizedBuiltMap },
          { offset: { line: 2, column: 11 }, map: normalizedEmptyMap },
          {
            offset: { line: 3, column: 8 },
            map: {
              version: 3,
              file: undefined,
              sections: [
                { offset: { line: 1, column: 10 }, map: normalizedBuiltMap },
                { offset: { line: 1, column: 13 }, map: normalizedEmptyMap },
                { offset: { line: 2, column: 10 }, map: normalizedBuiltMap },
                { offset: { line: 2, column: 13 }, map: normalizedEmptyMap },
              ],
            },
          },
          { offset: { line: 6, column: 8 }, map: normalizedEmptyMap },
        ],
      });
    });
  });

  describe('unnormalizedBuild', () => {
    const emptyMap = {
      version: 3 as const,
      names: [],
      sources: [],
      mappings: '',
    };

    it('builds sourceless code', () => {
      const built = unnormalizedBuild`
        foo
      `;

      assert.equal(built.code, '\n        foo\n      ');
      assert.deepEqual(built.map, { version: 3, sections: [] });
    });

    it('builds sourced code', () => {
      const built = unnormalizedBuild`${builtCode}`;

      assert.equal(built.code, 'foo');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [{ offset: { line: 0, column: 0 }, map: builtCode.map }],
      });
    });

    it('combines sourceless code', () => {
      const built = unnormalizedBuild`
        ${'foo'}${'bar'} ${'baz'}
      `;

      assert.equal(built.code, '\n        foobar baz\n      ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [],
      });
    });

    it('combines sourced code', () => {
      const built = unnormalizedBuild`
        ${builtCode}${builtCode} ${builtCode}
      `;

      assert.equal(built.code, '\n        foofoo foo\n      ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [
          { offset: { line: 1, column: 8 }, map: builtCode.map },
          { offset: { line: 1, column: 11 }, map: builtCode.map },
          { offset: { line: 1, column: 14 }, map: emptyMap },
          { offset: { line: 1, column: 15 }, map: builtCode.map },
          { offset: { line: 1, column: 18 }, map: emptyMap },
        ],
      });
    });

    it('combines sourceless and sourced code', () => {
      const built = unnormalizedBuild`
        bar
        ${builtCode}
        baz
      `;

      assert.equal(built.code, '\n        bar\n        foo\n        baz\n      ');
      assert.deepEqual(built.map, {
        version: 3,
        sections: [
          { offset: { line: 2, column: 8 }, map: builtCode.map },
          { offset: { line: 2, column: 11 }, map: emptyMap },
        ],
      });
    });

    it('input to AnyMap', () => {
      const { map } = unnormalizedBuild`
        ${builtCode}
      `;

      const tracer = AnyMap(map);

      assert.deepEqual(originalPositionFor(tracer, { line: 2, column: 8 }), {
        source: 'foo.js',
        line: 1,
        column: 0,
        name: null,
      });
    });

    it('normalizes SectionedSourceMapInput', () => {
      const built = unnormalizedBuild`
        ${builtCode}
        ${{ code: builtCode.code, map: JSON.stringify(builtCode.map) }}
        ${build`
          ${{ code: builtCode.code, map: tracer }}
          ${{ code: builtCode.code, map: decodedMap(tracer) as any }}
        `}
      `;
      const normalizedEmptyMap = encodedMap(new TraceMap(emptyMap));

      const normalized = normalizeMap(built.map);
      assert.deepEqual(normalized, {
        version: 3,
        file: undefined,
        sections: [
          { offset: { line: 1, column: 8 }, map: normalizedBuiltMap },
          { offset: { line: 1, column: 11 }, map: normalizedEmptyMap },
          { offset: { line: 2, column: 8 }, map: normalizedBuiltMap },
          { offset: { line: 2, column: 11 }, map: normalizedEmptyMap },
          {
            offset: { line: 3, column: 8 },
            map: {
              version: 3,
              file: undefined,
              sections: [
                { offset: { line: 1, column: 10 }, map: normalizedBuiltMap },
                { offset: { line: 1, column: 13 }, map: normalizedEmptyMap },
                { offset: { line: 2, column: 10 }, map: normalizedBuiltMap },
                { offset: { line: 2, column: 13 }, map: normalizedEmptyMap },
              ],
            },
          },
          { offset: { line: 6, column: 8 }, map: normalizedEmptyMap },
        ],
      });
    });
  });
});
