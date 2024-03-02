import type {
  DecodedSourceMap,
  SectionedSourceMapInput,
  SectionedSourceMapXInput,
  SectionXInput,
} from '@jridgewell/trace-mapping';

export type DynamicCode = string | BuiltCode;
export type BuiltCode = {
  code: string;
  map: SectionedSourceMapInput;
};

const NEWLINE = '\n'.charCodeAt(0);
const CARRIAGE_RETURN = '\r'.charCodeAt(0);

// Used to mark a sourceless section after a sourced section, ensuring that the sourced section does
// not overlap into our sourceless section.
const EMPTY_MAP: DecodedSourceMap = {
  version: 3,
  sources: [],
  names: [],
  mappings: [],
};

// We use module-level variables to handle multiple return values without creating temporary
// objects. As long as `build` isn't called reentrantly, it's fine. And using as a Tagged Template
// Literal does just that.
let line = 0;
let column = 0;
let lastIsSourceless = true;

// We use a call interface instead of the regular function types, allowing us to publicly advertise
// the rest args without actually constructing it.
interface Builder {
  (strings: TemplateStringsArray, ...args: DynamicCode[]): {
    code: string;
    map: SectionedSourceMapXInput;
  };
}

export const build: Builder = function (strings) {
  let code = strings[0];
  const sections: SectionXInput[] = [];

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
      code = pushSource(code, value, sections);
    }
    code = pushSourceless(code, next, sections);
  }

  const map = { version: 3 as const, sections };
  return { code, map };
};

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
function pushSourceless(code: string, value: string, sections: SectionXInput[]): string {
  if (value.length === 0) return code;

  // If the previous section is sourceless, then we don't need to push a new mapping. The previous
  // section's empty map can continue to cover this section's code as well.
  if (!lastIsSourceless) sections.push({ offset: { line, column }, map: EMPTY_MAP });
  lastIsSourceless = true;

  updatePosition(value);
  return code + value;
}

function pushSource(code: string, value: BuiltCode, sections: SectionXInput[]): string {
  const { code: c, map } = value;

  // We always push sections for mapped code.
  sections.push({ offset: { line, column }, map });
  lastIsSourceless = false;

  updatePosition(c);
  return code + c;
}
