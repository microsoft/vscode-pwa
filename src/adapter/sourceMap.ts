/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as utils from '../utils';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class SourceMap {
  private _json?: SourceMapV3;
  private _url: string;
  private _mappings?: SourceMapEntry[];
  private _sourceInfos: Map<string, SourceInfo> = new Map();
  private _errors: string[] = [];

  static async load(url: string): Promise<SourceMap | undefined> {
    let content;
    try {
      content = await utils.fetch(url);
    } catch (e) {
      return;
    }

    if (content.slice(0, 3) === ')]}')
      content = content.substring(content.indexOf('\n'));
    try {
      const payload = JSON.parse(content) as SourceMapV3;
      return new SourceMap(url, payload);
    } catch (e) {
      return;
    }
  }

  constructor(url: string, payload: SourceMapV3) {
    this._json = payload;
    this._url = url;

    this._mappings = undefined;
    if (this._json.sections) {
      const sectionWithUrl = !!this._json.sections.find(section => !!section['url']);
      if (sectionWithUrl)
        this._errors.push(localize('error.sourceMapUnsupportedSectionUrl', 'SourceMap "{0}" contains unsupported "URL" field in one of its sections.', this._url));
    }
    this._forEachSection(map => {
      let sourceRoot = map.sourceRoot || '';
      if (sourceRoot && !sourceRoot.endsWith('/'))
        sourceRoot += '/';
      for (let i = 0; i < map.sources.length; ++i) {
        const url = sourceRoot + map.sources[i];
        map.sources[i] = url;
        const source = map.sourcesContent && map.sourcesContent[i];
        this._sourceInfos.set(url, new SourceInfo(source));
      }
    });
  }

  errors(): string[] {
    return this._errors;
  }

  url(): string {
    return this._url;
  }

  sourceUrls(): string[] {
    return Array.from(this._sourceInfos.keys());
  }

  sourceContent(sourceURL: string): string | undefined {
    const info = this._sourceInfos.get(sourceURL)!;
    return info.content;
  }

  findEntry(lineNumber: number, columnNumber: number): SourceMapEntry | undefined {
    const mappings = this.mappings();
    const index = upperBound(mappings, entry => lineNumber - entry.lineNumber || columnNumber - entry.columnNumber);
    return index ? mappings[index - 1] : undefined;
  }

  mappings(): SourceMapEntry[] {
    if (!this._mappings) {
      const mappings: SourceMapEntry[] = [];
      this._forEachSection(this._parseMap.bind(this, mappings));
      this._mappings = mappings;
      this._json = undefined;
    }
    return this._mappings;
  }

  findReverseEntry(sourceUrl: string, lineNumber: number, columnNumber: number): SourceMapEntry | undefined {
    const mappings = this._reversedMappings(sourceUrl);
    const first = lowerBound(mappings, (mapping: SourceMapEntry) => lineNumber - (mapping.sourceLineNumber || 0));
    const last = upperBound(mappings, (mapping: SourceMapEntry) => lineNumber - (mapping.sourceLineNumber || 0));
    if (first >= mappings.length || mappings[first].sourceLineNumber !== lineNumber)
      return;
    const columnMappings = mappings.slice(first, last);
    if (!columnMappings.length)
      return;
    const index = lowerBound(columnMappings, (mapping: SourceMapEntry) => columnNumber - (mapping.sourceColumnNumber || 0));
    return index >= columnMappings.length ? columnMappings[columnMappings.length - 1] : columnMappings[index];
  }

  _parseMap(mappings: SourceMapEntry[], map: SourceMapV3, lineNumber: number, columnNumber: number) {
    let sourceIndex = 0;
    let sourceLineNumber = 0;
    let sourceColumnNumber = 0;
    let nameIndex = 0;
    const names = map.names || [];
    const stringCharIterator = new StringCharIterator(map.mappings);
    let sourceURL = map.sources[sourceIndex];

    while (true) {
      if (stringCharIterator.peek() === ',') {
        stringCharIterator.next();
      } else {
        while (stringCharIterator.peek() === ';') {
          lineNumber += 1;
          columnNumber = 0;
          stringCharIterator.next();
        }
        if (!stringCharIterator.hasNext())
          break;
      }

      columnNumber += decodeVLQ(stringCharIterator);
      if (!stringCharIterator.hasNext() || isSeparator(stringCharIterator.peek())) {
        mappings.push(new SourceMapEntry(lineNumber, columnNumber));
        continue;
      }

      const sourceIndexDelta = decodeVLQ(stringCharIterator);
      if (sourceIndexDelta) {
        sourceIndex += sourceIndexDelta;
        sourceURL = map.sources[sourceIndex];
      }
      sourceLineNumber += decodeVLQ(stringCharIterator);
      sourceColumnNumber += decodeVLQ(stringCharIterator);

      if (!stringCharIterator.hasNext() || isSeparator(stringCharIterator.peek())) {
        mappings.push(new SourceMapEntry(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber));
        continue;
      }

      nameIndex += decodeVLQ(stringCharIterator);
      mappings.push(new SourceMapEntry(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber, names[nameIndex]));
    }

    // As per spec, mappings are not necessarily sorted.
    mappings.sort(SourceMapEntry.compare);
  }

  _forEachSection(callback: (map: SourceMapV3, line: number, column: number) => void) {
    const json = this._json!;
    if (!json.sections) {
      callback(json, 0, 0);
      return;
    }
    for (const section of json.sections)
      callback(section.map, section.offset.line, section.offset.column);
  }

  _reversedMappings(sourceUrl: string): SourceMapEntry[] {
    const mappings = this.mappings();
    const info = this._sourceInfos.get(sourceUrl);
    if (!info)
      return [];
    if (!info.reverseMappings)
      info.reverseMappings = mappings.filter(mapping => mapping.sourceUrl === sourceUrl).sort(sourceMappingComparator);
    return info.reverseMappings;

    function sourceMappingComparator(a: SourceMapEntry, b: SourceMapEntry): number {
      if (a.sourceLineNumber !== b.sourceLineNumber)
        return (a.sourceLineNumber || 0) - (b.sourceLineNumber || 0);
      if (a.sourceColumnNumber !== b.sourceColumnNumber)
        return (a.sourceColumnNumber || 0) - (b.sourceColumnNumber || 0);
      if (a.lineNumber !== b.lineNumber)
        return a.lineNumber - b.lineNumber;
      return a.columnNumber - b.columnNumber;
    }
  }
};

export class SourceMapEntry {
  lineNumber: number;
  columnNumber: number;
  sourceUrl?: string;
  sourceLineNumber?: number;
  sourceColumnNumber?: number;
  name?: string;

  constructor(lineNumber: number, columnNumber: number, sourceUrl?: string, sourceLineNumber?: number, sourceColumnNumber?: number, name?: string) {
    this.lineNumber = lineNumber;
    this.columnNumber = columnNumber;
    this.sourceUrl = sourceUrl;
    this.sourceLineNumber = sourceLineNumber;
    this.sourceColumnNumber = sourceColumnNumber;
    this.name = name;
  }

  static compare(entry1: SourceMapEntry, entry2: SourceMapEntry) {
    if (entry1.lineNumber !== entry2.lineNumber)
      return entry1.lineNumber - entry2.lineNumber;
    return entry1.columnNumber - entry2.columnNumber;
  }
};

class SourceInfo {
  content?: string;
  reverseMappings?: SourceMapEntry[];

  constructor(content?: string, reverseMappings?: SourceMapEntry[]) {
    this.content = content;
    this.reverseMappings = reverseMappings;
  }
};

class StringCharIterator {
  private _string: string;
  private _position: number;

  constructor(string: string) {
    this._string = string;
    this._position = 0;
  }

  next(): string {
    return this._string.charAt(this._position++);
  }

  peek(): string {
    return this._string.charAt(this._position);
  }

  hasNext(): boolean {
    return this._position < this._string.length;
  }
};

interface SourceMapV3 {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent?: string[];
  sections?: SourceMapV3Section[];
  mappings: string;
  sourceRoot?: string;
  names?: string[];
};

interface SourceMapV3Section {
  offset: SourceMapV3Offset;
  map: SourceMapV3;
};

interface SourceMapV3Offset {
  line: number;
  column: number;
};

const base64Map: Object = (() => {
  const base64Digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const result = {};
  for (let i = 0; i < base64Digits.length; ++i)
    result[base64Digits.charAt(i)] = i;
  return result;
})();

function isSeparator(char: string): boolean {
  return char === ',' || char === ';';
}

function decodeVLQ(stringCharIterator: StringCharIterator): number {
  // Read unsigned value.
  let result = 0;
  let shift = 0;
  let digit;
  do {
    digit = base64Map[stringCharIterator.next()];
    result += (digit & VLQ_BASE_MASK) << shift;
    shift += VLQ_BASE_SHIFT;
  } while (digit & VLQ_CONTINUATION_MASK);

  // Fix the sign.
  const negative = result & 1;
  result >>= 1;
  return negative ? -result : result;
}

const VLQ_BASE_SHIFT = 5;
const VLQ_BASE_MASK = (1 << 5) - 1;
const VLQ_CONTINUATION_MASK = 1 << 5;

function upperBound<S>(array: S[], comparator: (s: S) => number): number {
  let l = 0;
  let r = array.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (comparator(array[m]) >= 0)
      l = m + 1;
    else
      r = m;
  }
  return r;
}

function lowerBound<S>(array: S[], comparator: (s: S) => number): number {
  let l = 0;
  let r = array.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (comparator(array[m]) > 0)
      l = m + 1;
    else
      r = m;
  }
  return r;
}
