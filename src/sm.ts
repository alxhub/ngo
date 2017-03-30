import * as fs from 'fs';
import * as path from 'path';


import {SourceMapConsumer, MappingItem} from 'source-map';

const source = fs.readFileSync(process.argv[2]).toString();
const mapData = fs.readFileSync(`${process.argv[2]}.map`).toString();
const map = new SourceMapConsumer(mapData);

let canonicalMap: SourceMapConsumer|null = null;
if (process.argv.length > 3) {
  const canonicalData = fs.readFileSync(process.argv[3]).toString();
  canonicalMap = new SourceMapConsumer(canonicalData);
}

const lines = source.split('\n');
if (lines[lines.length - 1].indexOf('//# sourceMappingURL=') === 0) {
  lines.pop();
}

let lineData = {};
function dataForLine(genLine: number): MappingItem[] {
  if (!lineData[genLine]) {
    lineData[genLine] = [];
  }
  return lineData[genLine];
}

let sourceData = {};
function addSourceData(source: string, span: number): void {
  if (source.indexOf('webpack:///') === 0) {
    source = source.substr('webpack:///'.length);
  }

  if (!sourceData[source]) {
    sourceData[source] = 0;
  }
  sourceData[source] += span;
}

let highestGenLine = 0;

const lineIsLicenseComment = /^\s*\/?\*/;

map.eachMapping(mapping => {
  dataForLine(mapping.generatedLine).push(mapping);
  if (mapping.generatedLine > highestGenLine) {
    highestGenLine = mapping.generatedLine;
  }
});

if (highestGenLine !== lines.length) {
  console.log(`mismatch in line numberings: source map has ${highestGenLine} lines but actual file has ${lines.length}`);
}

let smSize = 0;
let fileSize = 0;

for (let i = 1; i <= lines.length; i++) {
  const mappings = dataForLine(i);
  if (mappings.length === 0 && !lineIsLicenseComment.test(lines[i - 1])) {
    console.log(`${i} has no mappings but does not appear to be a license comment`);
  } else if (mappings.length === 0) {
    // skip license line.
    continue;
  }
  let minPos = 9999999999;
  let maxPos = 0;

  const lineLength = lines[i - 1].length;

  let lastMapping: MappingItem|null = null;

  mappings.forEach(mapping => {
    if (mapping.generatedColumn < minPos) {
      minPos = mapping.generatedColumn;
    }
    if (mapping.generatedColumn > maxPos) {
      maxPos = mapping.generatedColumn;
    }

    if (lastMapping !== null) {
      const span = mapping.generatedColumn - lastMapping.generatedColumn;
      (lastMapping as any)._size = span;
      addSourceData(lastMapping.source, span);
    }
    lastMapping = mapping;
  });
  if (lastMapping !== null) {
    const span = lineLength - lastMapping.generatedColumn;
    (lastMapping as any)._size = span;
    addSourceData(lastMapping.source, span);
  }

  const smLength = maxPos - minPos;

  fileSize += lineLength;
  smSize += smLength;

  const discrepency = lineLength - smLength;

  if (discrepency > 40) {
    console.log(`${i} map goes from ${minPos} - ${maxPos} true length is ${lineLength} - discrepency is ${discrepency}`)
  }
}

console.log(`file size: ${fileSize}`);
console.log(`size by sm: ${smSize}`);

const diff = fileSize - smSize;
const pct = Math.round(10000 * diff / fileSize) / 100;

console.log(`size difference: ${fileSize - smSize} (${pct}%)`);

let root = {children: {}, size: 0};

function accountKey(rootNode, key: string, size: number) {
  let node = rootNode;
  key.split('/').forEach(piece => {
    if (!node.children[piece]) {
      node.children[piece] = {children: {}, size};
    } else {
      node.children[piece].size += size;
    }
    node = node.children[piece];
  });
  rootNode.size += size;
}

Object.keys(sourceData).forEach(key => {
  accountKey(root, key, sourceData[key]);
});

function percent(size: number, total: number): number {
  const pct = Math.round(10000 * size / total) / 100;
  return pct;
}

function printSizesToLevel(source: string, obj: any, level: number): void {
  let displaySrc = source || '/';
  console.log(`${displaySrc}: ${obj.size} (${percent(obj.size, fileSize)}%)`);
  if (level > 0) {
    Object.keys(obj.children).forEach(child => {
      printSizesToLevel(`${source}/${child}`, obj.children[child], level - 1);
    });
  }
}

printSizesToLevel('', root, 3);

// Try to figure out canonical stuff.

if (canonicalMap !== null) {
  const vendor = `webpack:///${path.basename(process.argv[2])}`;
  console.log('canonical vendor breakdown:');
  canonicalMap = map;

  let canonicalSources = {};

  let runningOnLine = 0;
  map.eachMapping(mapping => {
    if (mapping.generatedLine > runningOnLine) {
      runningOnLine = mapping.generatedLine;
      console.log(`(processing ${runningOnLine})`);
    }
    if (mapping.source === vendor) {
      let closest: MappingItem|null = null;
      const start = mapping.generatedColumn;
      const end = mapping.generatedColumn + ((mapping as any)._size || 0);
      canonicalMap.eachMapping(canonicalMapping => {
        if (canonicalMapping.generatedLine !== mapping.generatedLine) {
          return;
        }
        if (canonicalMapping.generatedColumn < start && canonicalMapping.generatedColumn > end) {
          return;
        }
        
        let canonicalSource = canonicalMapping.source;
        if (canonicalSource.indexOf('webpack:///') === 0) {
          canonicalSource = canonicalSource.substr('webpack:///'.length);
        }
        canonicalSources[canonicalSource] = true;

        if (closest !== null && (mapping.generatedColumn - closest.generatedColumn) > (mapping.generatedColumn - canonicalMapping.generatedColumn)) {
          closest = canonicalMapping;
        } else {
          closest = canonicalMapping;
        }
      });
    }
  });

  Object.keys(canonicalSources).forEach(source => console.log(`- ${source}`));
}