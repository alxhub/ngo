import * as fs from 'fs';

import * as ts from 'typescript';
import {SourceMapConsumer, SourceMapGenerator} from 'source-map';
import {scrubFile} from './ngo';
const tmp = require('tmp');
module.exports = function(content: string, inMap) {
  if (typeof inMap === 'string') {
    inMap = JSON.parse(inMap);
  }
  // if (!inMap) {
  //   if (fs.existsSync(`${this.resourcePath}.map`)) {
  //     inMap = fs.readFileSync(`${this.resourcePath}.map`).toString();
  //   }
  // }
  const tmpFile = tmp.fileSync({postfix: '.js'}).name;
  console.log('temp file', this.request, tmpFile);
  fs.writeFileSync(tmpFile, content);
  let {contents, sourceMap} = scrubFile(tmpFile, this.request, this.resourcePath);
  if (contents === content) {
    this.callback(null, content, inMap);
    return;
  }
  if (!inMap) {
    // Don't produce a source map for input which had none.
    this.callback(null, contents);
    return;
  }
  const inMapConsumer = new SourceMapConsumer(inMap);
  const outMapConsumer = new SourceMapConsumer(sourceMap);
  const map = SourceMapGenerator.fromSourceMap(inMapConsumer);
  map.applySourceMap(outMapConsumer, inMap.source);
  this.callback(null, contents, map.toString());
}
