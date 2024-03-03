import { strict as assert } from 'assert';
import { build, unnormalizedBuild } from '../src/build-mapping';
import { AnyMap, originalPositionFor, TraceMap, encodedMap } from '@jridgewell/trace-mapping';

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
  });
});
