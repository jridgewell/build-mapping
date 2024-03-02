import {
  AnyMap,
  decodedMap,
  encodedMap,
  type DecodedSourceMap,
  type EncodedSourceMap,
  type Section,
  type SectionedSourceMap,
  type SourceMapV3,
} from '@jridgewell/trace-mapping';

export type SourceMapInput =
  | string
  | EncodedSourceMapXInput
  | DecodedSourceMapXInput
  | SectionedSourceMapXInput;
export type BuiltCode = {
  code: string;
  map: SourceMapInput;
};
export type DynamicCode = string | BuiltCode | BuildMap;
type Mapping = [number, number, SourceMapInput | Mapping[]];

// Temporary, until trace-mapping is updated.
type XInput = { x_google_ignoreList?: SourceMapV3['ignoreList'] };
type EncodedSourceMapXInput = EncodedSourceMap & XInput;
type DecodedSourceMapXInput = DecodedSourceMap & XInput;
type SectionXInput = Omit<Section, 'map'> & { map: SourceMapInput };
type SectionedSourceMapXInput = Omit<SectionedSourceMap, 'sections'> & {
  sections: SectionXInput[];
};

const NEWLINE = '\n'.charCodeAt(0);
const CARRIAGE_RETURN = '\r'.charCodeAt(0);
const EMPTY_MAP: DecodedSourceMap = {
  version: 3,
  sources: [],
  names: [],
  mappings: [],
};

export class BuildMap {
  declare code: string;
  private declare _map: Mapping[];

  constructor(code: string, mappings: Mapping[]) {
    this.code = code;
    this._map = mappings;
  }
}

let line = 0;
let column = 0;
let lastIsSynthetic = true;

interface Builder {
  (strings: TemplateStringsArray, ...args: DynamicCode[]): BuildMap;
}
export const build: Builder = function (strings) {
  let code = strings[0];
  const mappings: Mapping[] = [];
  lastIsSynthetic = true;
  line = 0;
  column = 0;
  updatePosition(code);

  for (let i = 1; i < arguments.length; i++) {
    const value = arguments[i] as DynamicCode;
    const next = strings[i];
    if (typeof value === 'string') {
      code = pushSynthetic(code, value, mappings);
    } else {
      const c = value.code;
      const mapping = isBuildMap(value) ? cast(value)._map : value.map;
      mappings.push([line, column, mapping]);
      lastIsSynthetic = false;
      updatePosition(c);
      code += c;
    }
    code = pushSynthetic(code, next, mappings);
  }

  return new BuildMap(code, mappings);
};

export function sectionedSourceMap(map: BuildMap): SectionedSourceMapXInput {
  const mappings = cast(map)._map;

  return {
    version: 3,
    sections: buildSections(mappings, 0, 0, []),
  };
}

export function decodedSouceMap(map: BuildMap): DecodedSourceMap {
  return decodedMap(AnyMap(sectionedSourceMap(map))) as DecodedSourceMap;
}

export function encodedSouceMap(map: BuildMap): EncodedSourceMap {
  return encodedMap(AnyMap(sectionedSourceMap(map))) as EncodedSourceMap;
}

function updatePosition(code: string) {
  let lastNewline = -1;
  for (let i = 0; i < code.length; i++) {
    switch (code.charCodeAt(i)) {
      case CARRIAGE_RETURN:
        if (i < code.length - 1 && code.charCodeAt(i + 1) === NEWLINE) i++;
      // fall through
      case NEWLINE:
        line++;
        lastNewline = i;
    }
  }
  column = lastNewline === -1 ? column + code.length : code.length - lastNewline - 1;
}

function pushSynthetic(code: string, value: string, mappings: Mapping[]): string {
  if (value.length === 0) return code;
  if (!lastIsSynthetic) mappings.push([line, column, EMPTY_MAP]);
  lastIsSynthetic = true;
  updatePosition(value);
  return code + value;
}

function buildSections(
  mappings: Mapping[],
  lineOffset: number,
  columnOffset: number,
  sections: SectionXInput[],
): SectionXInput[] {
  for (let i = 0; i < mappings.length; i++) {
    const { 0: l, 1: c, 2: mapping } = mappings[i];
    const line = l + lineOffset;
    const column = l === 0 ? c + columnOffset : c;
    if (isMappings(mapping)) buildSections(mapping, line, column, sections);
    else sections.push({ offset: { line, column }, map: mapping });
  }

  return sections;
}

interface PublicMap {
  _map: BuildMap['_map'];
}

/**
 * Typescript doesn't allow friend access to private fields, so this just casts the map into a type
 * with public access modifiers.
 */
function cast(map: unknown): PublicMap {
  return map as any;
}

function isBuildMap(value: BuiltCode | BuildMap): value is BuildMap {
  return !!value && Array.isArray((value as unknown as { _map: unknown })._map);
}

function isMappings(value: Mapping[] | SourceMapInput): value is Mapping[] {
  return Array.isArray(value);
}
