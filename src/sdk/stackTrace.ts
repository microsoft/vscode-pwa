/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Thread} from "./thread";
import {Location} from "./source";
import Cdp from "../cdp/api";

export interface StackFrame {
  id: number;
  name: string;
  location: Location;
  isAsyncSeparator?: boolean;
  scopeChain?: Cdp.Debugger.Scope[];
};

// TODO(dgozman): use stack trace format.
export class StackTrace {
  private static _lastFrameId = 0;
  private _thread: Thread;
  private _frames: StackFrame[] = [];
  private _frameById: Map<number, StackFrame> = new Map();
  private _asyncStackTraceId?: Cdp.Runtime.StackTraceId;

  public static fromRuntime(thread: Thread, stack: Cdp.Runtime.StackTrace): StackTrace {
    const result = new StackTrace(thread);
    for (const callFrame of stack.callFrames) {
      result._frames.push({
        id: ++StackTrace._lastFrameId,
        location: thread.locationFromRuntimeCallFrame(callFrame),
        name: callFrame.functionName || '<anonymous>'
      });
    }
    if (stack.parentId) {
      result._asyncStackTraceId = stack.parentId;
      console.assert(!stack.parent);
    } else if (stack.parent) {
      result._appendStackTrace(stack.parent);
    }
    return result;
  }

  public static fromDebugger(thread: Thread, frames: Cdp.Debugger.CallFrame[], parent?: Cdp.Runtime.StackTrace, parentId?: Cdp.Runtime.StackTraceId): StackTrace {
    const result = new StackTrace(thread);
    for (const callFrame of frames) {
      result._appendFrame({
        id: ++StackTrace._lastFrameId,
        location: thread.locationFromDebuggerCallFrame(callFrame),
        name: callFrame.functionName || '<anonymous>',
        scopeChain: callFrame.scopeChain
      });
    }
    if (parentId) {
      result._asyncStackTraceId = parentId;
      console.assert(!parent);
    } else if (parent) {
      result._appendStackTrace(parent);
    }
    return result;
  }

  constructor(thread: Thread) {
    this._thread = thread;
  }

  async loadFrames(limit: number): Promise<StackFrame[]> {
    while (this._frames.length < limit && this._asyncStackTraceId) {
      const {stackTrace} = await this._thread.cdp().Debugger.getStackTrace({stackTraceId: this._asyncStackTraceId});
      this._asyncStackTraceId = undefined;
      this._appendStackTrace(stackTrace);
    }
    return this._frames;
  }

  canLoadMoreFrames(): boolean {
    return !!this._asyncStackTraceId;
  }

  frame(frameId: number): StackFrame | undefined {
    return this._frameById.get(frameId);
  }

  _appendStackTrace(stackTrace: Cdp.Runtime.StackTrace) {
    console.assert(!this._asyncStackTraceId);

    while (stackTrace) {
      if (stackTrace.description === 'async function' && stackTrace.callFrames.length)
        stackTrace.callFrames.shift();

      if (stackTrace.callFrames.length) {
        this._appendFrame({
          id: ++StackTrace._lastFrameId,
          name: stackTrace.description || 'async',
          location: {
            lineNumber: 1,
            columnNumber: 1,
            url: '',
          },
          isAsyncSeparator: true
        });

        for (const callFrame of stackTrace.callFrames) {
          this._appendFrame({
            id: ++StackTrace._lastFrameId,
            location: this._thread.locationFromRuntimeCallFrame(callFrame),
            name: callFrame.functionName || '<anonymous>'
          });
        }
      }

      if (stackTrace.parentId) {
        this._asyncStackTraceId = stackTrace.parentId;
        console.assert(!stackTrace.parent);
      }

      stackTrace = stackTrace.parent;
    }
  }

  _appendFrame(frame: StackFrame) {
    this._frames.push(frame);
    this._frameById.set(frame.id, frame);
  }
};
