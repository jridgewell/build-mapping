# @jridgewell/build-mapping

> Build source and source maps

Allows you to iteratively build source code and source maps from previously generated code/maps.

## Installation

```sh
npm install @jridgewell/build-mapping
```

## Usage

```typescript
import { build } from '@jridgewell/build-mapping';

const input = transformFileSync('input.js')
const { code, map } = build`foo ${input} bar`;

assert.equal(code, `foo [input's code here…] bar`);
assert.deepEqual(map, {
  version: 3,
  sections: [
    { offset: { line: 0, column: 4 }, map: … },
    { offset: { line: 0, column: 24 }, map: … },
  ]
});





// This can be anything that generates { code, map }.
function transformFileSync(file: string): { code: string, map: string } {
  return babel.transformFileSync('input.js');
}
```
