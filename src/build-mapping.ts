import type {
  DecodedSourceMap,
  SectionedSourceMapInput,
  SectionXInput,
} from '@jridgewell/trace-mapping';

export type DynamicCode = string | BuiltCode;
export type BuiltCode = {
  code: string;
  map: SectionedSourceMapInput;
};

const NEWLINE = '\n'.charCodeAt(0);
const CARRIAGE_RETURN = '\r'.charCodeAt(0);
const EMPTY_MAP: DecodedSourceMap = {
  version: 3,
  sources: [],
  names: [],
  mappings: [],
};

let line = 0;
let column = 0;
let lastIsSynthetic = true;

interface Builder {
  (strings: TemplateStringsArray, ...args: DynamicCode[]): BuiltCode;
}

export const build: Builder = function (strings) {
  let code = strings[0];
  const sections: SectionXInput[] = [];

  lastIsSynthetic = true;
  line = 0;
  column = 0;
  updatePosition(code);

  for (let i = 1; i < arguments.length; i++) {
    const value = arguments[i] as DynamicCode;
    const next = strings[i];
    if (typeof value === 'string') {
      code = pushSourceless(code, value, sections);
    } else {
      code = pushSource(code, value, sections);
    }
    code = pushSourceless(code, next, sections);
  }

  const map = { version: 3 as const, sections };
  return { code, map };
};

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

function pushSourceless(code: string, value: string, sections: SectionXInput[]): string {
  if (value.length === 0) return code;
  if (!lastIsSynthetic) sections.push({ offset: { line, column }, map: EMPTY_MAP });
  lastIsSynthetic = true;
  updatePosition(value);
  return code + value;
}

function pushSource(code: string, value: BuiltCode, sections: SectionXInput[]): string {
  const { code: c, map } = value;
  sections.push({ offset: { line, column }, map });
  lastIsSynthetic = false;
  updatePosition(c);
  return code + c;
}
