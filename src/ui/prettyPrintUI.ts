/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import * as queryString from 'querystring';
import Dap from '../dap/api';
import { AdapterFactory } from '../adapterFactory';
import { Source } from '../adapter/sources';

let isDebugging = false;

export function registerPrettyPrintActions(context: vscode.ExtensionContext, factory: AdapterFactory) {
  context.subscriptions.push(vscode.debug.onDidStartDebugSession(session => updateDebuggingStatus()));
  context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => updateDebuggingStatus()));

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async editor => {
    if (!isDebugging || !editor || editor.document.languageId !== 'javascript')
      return;
    if (editor.document.uri.scheme !== 'debug' || !isMinified(editor.document))
      return;
    const source = await sourceForUri(factory, editor.document.uri);
    if (!source || !source.canPrettyPrint())
      return;
    const response = await vscode.window.showInformationMessage(
      'This JavaScript file seems to be minified.\nWould you like to pretty print it?',
      'Yes', 'No');
    if (response === 'Yes')
      vscode.commands.executeCommand('cdp.prettyPrint');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('cdp.prettyPrint', async e => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !factory.activeAdapter())
      return;
    const uri = editor.document.uri;
    if (uri.scheme !== 'debug')
      return;
    const source = await sourceForUri(factory, editor.document.uri);
    if (!source || !source.canPrettyPrint())
      return;
    await source.prettyPrint();
  }));
}

function sourceForUri(factory: AdapterFactory, uri: vscode.Uri): Source | undefined {
  const query = queryString.parse(uri.query);
  const ref: Dap.Source = { path: uri.path, sourceReference: +(query['ref'] as string)};
  const sessionId = query['session'] as string;
  const adapter = factory.adapter(sessionId || '');
  if (!adapter)
    return;
  return adapter.sourceContainer.source(ref);
}

function updateDebuggingStatus() {
  isDebugging = !!vscode.debug.activeDebugSession && vscode.debug.activeDebugSession.type === 'cdp';
}

function isMinified(document: vscode.TextDocument): boolean {
  const maxNonMinifiedLength = 500;
  const linesToCheck = 10;
  for (let i = 0; i < linesToCheck && i < document.lineCount; ++i) {
    const line = document.lineAt(i).text;
    if (line.length > maxNonMinifiedLength && !line.startsWith('//#'))
      return true;
  }
  return false;
}
