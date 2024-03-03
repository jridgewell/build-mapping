import { TraceMap, encodedMap } from '@jridgewell/trace-mapping';
import type {
  EncodedSourceMap,
  SectionedSourceMapInput,
  SectionedSourceMapXInput,
  SectionXInput,
} from '@jridgewell/trace-mapping';

export type DynamicCode = string | BuiltCode;
export interface BuiltCode {
  code: string;
  map: SectionedSourceMapInput;
}

export type NormalizedSourceMap = EncodedSourceMap | NormalizedSectionedSourceMap;
export interface NormalizedSectionedSourceMap {
  file?: string | null;
  sections: NormalizedSection[];
  version: 3;
}
export type NormalizedSection = NormalizeSection<true>;
export interface NormalizedBuiltCode {
  code: string;
  map: NormalizedSourceMap;
}

const NEWLINE = '\n'.charCodeAt(0);
const CARRIAGE_RETURN = '\r'.charCodeAt(0);

// Used to mark a sourceless section after a sourced section, ensuring that the sourced section does
// not overlap into our sourceless section.
const EMPTY_MAP: EncodedSourceMap = {
  version: 3,
  sources: [],
  names: [],
  mappings: '',
};

// We use module-level variables to handle multiple return values without creating temporary
// objects. As long as `build` isn't called reentrantly, it's fine. And using as a Tagged Template
// Literal does just that.
let line = 0;
let column = 0;
let lastIsSourceless = true;

type Normalize<T> = T extends true ? NormalizedSourceMap : SectionedSourceMapInput;
type Normalizer<T> = (map: SectionedSourceMapInput) => Normalize<T>;
type NormalizeSection<T> = {
  offset: { line: number; column: number };
  map: Normalize<T>;
};
// We use a call interface instead of the regular function types, allowing us to publicly advertise
// the rest args without actually constructing it.
interface Builder<T> {
  (strings: TemplateStringsArray, ...args: DynamicCode[]): { code: string; map: Normalize<T> };
}

/**
 * Builds a combined source and source map from many inputs.
 */
export const normalizedBuild: Builder<true> = /*#__PURE__*/ makeBuild(normalizeMap);
export { normalizedBuild as build };

/**
 * Builds a combined source and source map from many inputs.
 *
 * **Note** that the output of this function is only compatible with `@jridgewell/trace-mapping`. If
 * you wish to use this with another library, call `normalizeMap`.
 */
export const unnormalizedBuild: Builder<false> = /*#__PURE__*/ makeBuild((map) => map);

function makeBuild<T>(normalizer: Normalizer<T>): Builder<T> {
  return function (strings) {
    let code = strings[0];
    const sections: NormalizeSection<T>[] = [];

    lastIsSourceless = true;
    line = 0;
    column = 0;
    updatePosition(code);

    for (let i = 1; i < arguments.length; i++) {
      const value = arguments[i] as DynamicCode;
      const next = strings[i];
      if (typeof value === 'string') {
        code = pushSourceless(code, value, sections);
      } else {
        const { code: c, map } = value;

        // We always push sections for mapped code.
        sections.push({ offset: { line, column }, map: normalizer(map) });
        lastIsSourceless = false;

        updatePosition(c);
        code += c;
      }
      code = pushSourceless(code, next, sections);
    }

    const map = { version: 3 as const, sections };
    return { code, map };
  } as Builder<T>;
}

// Scans code looking for newlines, recording the current line number and final column number.
function updatePosition(code: string) {
  let lastNewline = -1;
  for (let i = 0; i < code.length; i++) {
    switch (code.charCodeAt(i)) {
      case CARRIAGE_RETURN:
        // \r\n is considered a single line break.
        if (i < code.length - 1 && code.charCodeAt(i + 1) === NEWLINE) i++;
      // fall through
      case NEWLINE:
        line++;
        lastNewline = i;
    }
  }
  // If no new line was encountered, then code continues from the same column.
  // If one is found, then the column is from that newline.
  column = lastNewline === -1 ? column + code.length : code.length - lastNewline - 1;
}

// A sourceless section is either the static source text from the tagged template literal, or it's a
// dynamically evaluated string.
function pushSourceless<T>(code: string, value: string, sections: NormalizeSection<T>[]): string {
  if (value.length === 0) return code;

  // If the previous section is sourceless, then we don't need to push a new mapping. The previous
  // section's empty map can continue to cover this section's code as well.
  if (!lastIsSourceless) sections.push({ offset: { line, column }, map: EMPTY_MAP });
  lastIsSourceless = true;

  updatePosition(value);
  return code + value;
}

/**
 * Normalizes the map output of `build` to be compatible with any library that supports source maps.
 */
export function normalizeMap<T extends SectionedSourceMapInput>(
  map: T extends NormalizedSectionedSourceMap ? never : T,
): NormalizedSourceMap {
  const parsed: Exclude<SectionedSourceMapInput, string> =
    typeof map === 'string' ? JSON.parse(map) : map;

  if ('sections' in parsed) return normalizeSectionedMap(parsed);
  return encodedMap(new TraceMap(parsed));
}

function normalizeSectionedMap(map: SectionedSourceMapXInput): NormalizedSectionedSourceMap {
  const { file, version, sections } = map;
  return { file, version, sections: sections.map(normalizeSection) };
}

function normalizeSection(section: SectionXInput): NormalizedSection {
  const { offset, map } = section;
  return { offset, map: normalizeMap(map) };
}
