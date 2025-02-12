/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { homedir } from 'os';
import { SourceMapTimeouts } from './adapter/sourceContainer';
import { DebugType } from './common/contributionUtils';
import { nodeInternalsToken } from './common/node15Internal';
import { assertNever, filterValues } from './common/objUtils';
import Dap from './dap/api';
import { AnyRestartOptions } from './targets/node/restartPolicy';

export interface IMandatedConfiguration extends Dap.LaunchParams {
  /**
   * The type of the debug session.
   */
  type: string;

  /**
   * The name of the debug session.
   */
  name: string;

  /**
   * The request type of the debug session.
   */
  request: string;

  /**
   * Options that configure when the VS Code debug console opens.
   */
  internalConsoleOptions?: 'neverOpen' | 'openOnSessionStart' | 'openOnFirstSessionStart';

  // Lifecycle tasks:
  preLaunchTask?: string;
  postDebugTask?: string;
  preRestartTask?: string;
  postRestartTask?: string;
}

export const enum OutputSource {
  Console = 'console',
  Stdio = 'std',
}

export interface ILoggingConfiguration {
  /**
   * Whether to return trace data from the launched application or browser.
   */
  stdio: boolean;

  /**
   * Configures where on disk logs are written. If this is null, no logs
   * will be written, otherwise the extension log directory (in VS Code) or
   * OS tmpdir (in VS) will be used.
   */
  logFile: string | null;
}

/**
 * Configuration for async stacks. See {@link IAsyncStackPolicy} for reasoning.
 *  - `true` aliases { onBoot: 32 }
 *  - `false` disables async stacks
 *  - `{ onBoot: N }` enables N async stacks when a target attaches
 *  - `{ onceBreakpointResolved: N }` enables N async stacks the first time a
 *    breakpoint is verified or hit.
 */
export type AsyncStackMode = boolean | { onAttach: number } | { onceBreakpointResolved: number };

export interface IBaseConfiguration extends IMandatedConfiguration {
  /**
   * A list of minimatch patterns for locations (folders and URLs) in which
   * source maps can be used to resolve local files. This can be used to avoid
   * incorrectly breaking in external source mapped code. Patterns can be
   * prefixed with "!" to exclude them. May be set to an empty array or null
   * to avoid restriction.
   */
  resolveSourceMapLocations: ReadonlyArray<string> | null;

  /**
   * Locations that should be scanned while looking for sourcemaps. Patterns
   * can be prefixed with "!" to exclude them.
   */
  outFiles: ReadonlyArray<string>;

  /**
   * Whether to pause when sourcemapped scripts are loaded to load their
   * sourcemap and ensure breakpoints are set.
   */
  pauseForSourceMap: boolean;

  /**
   * Show the async calls that led to the current call stack.
   */
  showAsyncStacks: AsyncStackMode;

  /**
   * An array of glob patterns for files to skip when debugging.
   */
  skipFiles: ReadonlyArray<string>;

  /**
   * Automatically step through generated code that cannot be mapped back to the original source.
   */
  smartStep: boolean;

  /**
   * Use JavaScript source maps (if they exist).
   */
  sourceMaps: boolean;

  /**
   * Whether to use the "names" mapping in sourcemaps. This requires requesting
   * source content, which can be slow with certain debuggers.
   */
  sourceMapRenames: boolean;

  /**
   * A set of mappings for rewriting the locations of source files from what
   * the sourcemap says, to their locations on disk.
   */
  sourceMapPathOverrides: { [key: string]: string };

  /**
   * Retry for this number of milliseconds to connect to the debug adapter.
   */
  timeout: number;

  /**
   * Timeouts for several operations.
   */
  timeouts: Partial<Timeouts>;

  /**
   * Logging configuration
   */
  trace: boolean | Partial<ILoggingConfiguration>;

  /**
   * Location where sources can be found.
   */
  rootPath?: string;

  /**
   * From where to capture output messages: The debug API, or stdout/stderr streams.
   */
  outputCapture: OutputSource;

  /**
   * Toggles whether we verify the contents of files on disk match the ones
   * loaded in the runtime. This is useful in a variety of scenarios and
   * required in some, but can cause issues if you have server-side
   * transformation of scripts, for example.
   */
  enableContentValidation: boolean;

  /**
   * A list of debug sessions which, when this debug session is terminated,
   * will also be stopped.
   */
  cascadeTerminateToConfigurations: string[];

  /**
   * Toggles whether the debugger will try to read DWARF debug symbols from
   * WebAssembly, which can be resource intensive. Requires the
   * `ms-vscode.wasm-dwarf-debugging` extension to function.
   */
  enableDWARF: boolean;

  /**
   * The value of the ${workspaceFolder} variable
   */
  __workspaceFolder: string;

  /**
   * Cache directory for workspace-related configuration.
   */
  __workspaceCachePath?: string;

  /**
   * If a file starts with this prefix, we'll consider it a remote file, and perform it's operation thorugh DAP requests
   */
  __remoteFilePrefix: string | undefined;

  /**
   * Whether to stop if a conditional breakpoint throws an error.
   */
  __breakOnConditionalError: boolean;

  /**
   * Function used to generate the description of the objects shown in the debugger
   * e.g.: "function (defaultDescription) { return this.toString(); }"
   */
  customDescriptionGenerator?: string;

  /**
   * Function used to generate the custom properties to show for objects in the debugger
   * e.g.: "function () { return {...this, extraProperty: 'otherProperty' } }"
   */
  customPropertiesGenerator?: string;
}

export type Timeouts = SourceMapTimeouts & {
  /**
   * When evaluating the symbol that is hovered in the editor, we wait no longer than |hoverEvaluation| timeout before evaluation is canceled.
   * Use 0 to never time out.
   */
  hoverEvaluation: number;
};

export interface IExtensionHostBaseConfiguration extends INodeBaseConfiguration {
  type: DebugType.ExtensionHost;

  /**
   * Command line arguments passed to the program.
   */
  args: ReadonlyArray<string>;

  /**
   * If source maps are enabled, these glob patterns specify the generated
   * JavaScript files. If a pattern starts with `!` the files are excluded.
   * If not specified, the generated code is expected in the same directory
   * as its source.
   */
  outFiles: ReadonlyArray<string>;

  /**
   * Path to the VS Code binary.
   */
  runtimeExecutable: string | null;
}

export interface IExtensionHostLaunchConfiguration extends IExtensionHostBaseConfiguration {
  request: 'launch';

  /**
   * Whether we should try to attach to webviews in the launched
   * VS Code instance.
   */
  debugWebviews: boolean;

  /**
   * Whether we should try to attach to debug the web worker extension host.
   */
  debugWebWorkerHost: boolean;

  /**
   * Chrome launch options used when attaching to the renderer process.
   */
  rendererDebugOptions: Partial<IChromeAttachConfiguration>;

  /**
   * Path to a test configuration file for the test CLI.
   * @see https://code.visualstudio.com/api/working-with-extensions/testing-extension#quick-setup-the-test-cli
   */
  testConfiguration?: string;

  /**
   * A single configuration to run from the file. If not specified, the user
   * may be asked to pick.
   */
  testConfigurationLabel?: string;

  /**
   * Port the extension host is listening on.
   */
  port?: number;

  /**
   * Extension host session ID. A "magical" value set by VS Code.
   */
  __sessionId: string;
}

export interface IExtensionHostAttachConfiguration extends IExtensionHostBaseConfiguration {
  type: DebugType.ExtensionHost;
  request: 'attach';
  debugWebviews: boolean;
  debugWebWorkerHost: boolean;
  __sessionId: string;
  port: number;
  rendererDebugOptions: Partial<IChromeAttachConfiguration>;
}

/**
 * Common configuration for the Node debugger.
 */
export interface INodeBaseConfiguration extends IBaseConfiguration, IConfigurationWithEnv {
  /**
   * Absolute path to the working directory of the program being debugged.
   */
  cwd?: string;
  /**
   * If source maps are enabled, these glob patterns specify the generated
   * JavaScript files. If a pattern starts with `!` the files are excluded.
   * If not specified, the generated code is expected in the same directory
   * as its source.
   */
  outFiles: ReadonlyArray<string>;

  /**
   * Path to the local directory containing the program.
   */
  localRoot: string | null;

  /**
   * Path to the remote directory containing the program.
   */
  remoteRoot: string | null;

  /**
   * Attach debugger to new child processes automatically.
   */
  autoAttachChildProcesses: boolean;

  /**
   * A list of patterns at which to manually insert entrypoint breakpoints.
   * This can be useful to give the debugger an opportunity to set breakpoints
   * when using sourcemaps that don't exist or can't be detected before launch.
   * @see https://github.com/microsoft/vscode-js-debug/issues/492
   */
  runtimeSourcemapPausePatterns: ReadonlyArray<string>;

  /**
   * Allows you to explicitly specify the Node version that's running, which
   * can be used to disable or enable certain behaviors in cases where the
   * automatic version detection does not working.
   */
  nodeVersionHint?: number;

  /**
   * Whether to automatically resume processes if we see they were launched
   * with `--inpect-brk`.
   */
  continueOnAttach?: boolean;
}

export interface IConfigurationWithEnv {
  /**
   * Environment variables passed to the program. The value `null` removes the
   * variable from the environment.
   */
  env: Readonly<{ [key: string]: string | null }>;

  /**
   * Absolute path to a file containing environment variable definitions.
   */
  envFile: string | null;
}

export const enum KillBehavior {
  Forceful = 'forceful',
  Polite = 'polite',
  None = 'none',
}

/**
 * Configuration for a launch request.
 */
export interface INodeLaunchConfiguration extends INodeBaseConfiguration, IConfigurationWithEnv {
  type: DebugType.Node;
  request: 'launch';

  /**
   * @override
   */
  cwd: string;

  /**
   * Program to use to launch the debugger.
   */
  program?: string;

  /**
   * Automatically stop program after launch. It can be set to a boolean, or
   * the absolute filepath to stop in. Setting a path for stopOnEntry should
   * only be needed in esoteric scenarios where it cannot be inferred
   * from the run args.
   */
  stopOnEntry: boolean | string;

  /**
   * Where to launch the debug target.
   */
  console: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';

  /**
   * Command line arguments passed to the program.
   */
  args: string | ReadonlyArray<string>;

  /**
   * Restart session after Node.js has terminated.
   */
  restart: AnyRestartOptions;

  /**
   * Runtime to use. Either an absolute path or the name of a runtime
   * available on the PATH. If omitted `node` is assumed.
   */
  runtimeExecutable: string | null;

  /**
   * Version of `node` runtime to use. Requires `nvm`.
   */
  runtimeVersion: string;

  /**
   * Optional arguments passed to the runtime executable.
   */
  runtimeArgs: ReadonlyArray<string>;

  /**
   * If true, will start profiling soon as the process launches.
   */
  profileStartup: boolean;

  /**
   * Legacy debug port. Now, only used for --inspect-brk compatbility.
   * @see https://github.com/microsoft/vscode-js-debug/issues/584
   * @deprecated
   */
  port?: number;

  /**
   * Simple port to attach to. If set, attach mode will be used and no
   * bootloader will be injected. This is less desirable than letting the
   * bootloader do its thing, but is needed is some esoteric cases (such as
   * Deno and cases where the "launch" actually runs a Docker container.)
   */
  attachSimplePort: null | number;

  /**
   * Configures how debug process are killed when stopping the sesssion. Can be:
   *  - forceful (default): forcefully tears down the process tree. Sends
   *    SIGKILL on posix, or `taskkill.exe /F` on Windows.
   *  - polite: gracefully tears down the process tree. It's possible that
   *    misbehaving processes continue to run after shutdown in this way. Sends
   *    SIGTERM on posix, or `taskkill.exe` with no `/F` (force) flag on Windows.
   *  - none: no termination will happen.
   */
  killBehavior: KillBehavior;

  /**
   * Whether to automatically add the `--experimental-network-inspection` flag.
   */
  experimentalNetworking: 'on' | 'off' | 'auto';
}

/**
 * A mapping of URLs/paths to local folders, to resolve scripts
 * in Chrome to scripts on disk
 */
export type PathMapping = Readonly<{ [key: string]: string }>;

export interface IChromiumBaseConfiguration extends IBaseConfiguration {
  /**
   * Controls whether to skip the network cache for each request.
   */
  disableNetworkCache: boolean;

  /**
   * A mapping of URLs/paths to local folders, to resolve scripts
   * in Chrome to scripts on disk
   */
  pathMapping: PathMapping;

  /**
   * This specifies the workspace absolute path to the webserver root. Used to
   * resolve paths like `/app.js` to files on disk. Shorthand for a pathMapping for "/".
   */
  webRoot: string;

  /**
   * Will navigate to this URL and attach to it. This can be omitted to
   * avoid navigation.
   */
  url: string | null;

  /**
   * Will search for a page with this url and attach to it, if found.
   * Can have * wildcards.
   */
  urlFilter: string;

  /**
   * Launch options to boot a server.
   */
  server: INodeLaunchConfiguration | ITerminalLaunchConfiguration | null;

  /**
   * A list of file glob patterns to find `*.vue` components. By default,
   * searches the entire workspace. This needs to be specified due to extra
   * lookups that Vue's sourcemaps require.
   */
  vueComponentPaths: ReadonlyArray<string>;

  /**
   * WebSocket (`ws://`) address of the inspector. It's a template string that
   * interpolates keys in `{curlyBraces}`. Available keys are:
   *
   *  - `url.*` is the parsed address of the running application. For instance,
   *    `{url.port}`, `{url.hostname}`
   *  - `port` is the debug port that Chrome is listening on.
   *  - `browserInspectUri` is the inspector URI on the launched browser
    ' - `browserInspectUriPath` is the path part of the inspector URI on the launched browser (e.g.: "/devtools/browser/e9ec0098-306e-472a-8133-5e42488929c2").\n' +
   *  - `wsProtocol` is the hinted websocket protocol. This is set to `wss` if
   *    the original URL is `https`, or `ws` otherwise.
   */
  inspectUri?: string | null;

  /**
   * Whether scripts are loaded individually with unique sourcemaps containing
   * the basename of the source file. This can be set to optimize sourcemap
   * handling when dealing with lots of small scripts. If set to "auto", we'll
   * detect known cases where this is appropriate.
   */
  perScriptSourcemaps: 'yes' | 'no' | 'auto';
}

/**
 * Opens a debugger-enabled terminal.
 */
export interface ITerminalLaunchConfiguration extends INodeBaseConfiguration {
  type: DebugType.Terminal;
  request: 'launch';

  /**
   * Command to run.
   */
  command?: string;
}

/**
 * Configuration for an attach request.
 */
export interface INodeAttachConfiguration extends INodeBaseConfiguration {
  type: DebugType.Node;
  request: 'attach';

  /**
   * Inspector webSocket address
   */
  websocketAddress?: string;

  /**
   * Explicit Host header to use when connecting to the websocket of inspector.
   * If not set, the host header will be set to 'localhost'.
   * This is useful when the inspector is running behind a proxy that only accept particular Host header.
   */
  remoteHostHeader?: string;

  /**
   * TCP/IP address of process to be debugged. Default is 'localhost'.
   */
  address: string;

  /**
   * Debug port to attach to. Default is 9229.
   */
  port: number;

  /**
   * Restart session after Node.js has terminated.
   */
  restart: AnyRestartOptions;

  /**
   * ID of process to attach to.
   */
  processId?: string;

  /**
   * Whether to attempt to attach to already-spawned child processes.
   */
  attachExistingChildren: boolean;
}

export interface IChromiumLaunchConfiguration extends IChromiumBaseConfiguration {
  request: 'launch';

  /**
   * Port for the browser to listen on.
   */
  port: number;

  /**
   * Optional working directory for the runtime executable.
   */
  cwd: string | null;

  /**
   * Optional dictionary of environment key/value.
   */
  env: { [key: string]: string | null };

  /**
   * A local html file to open in the browser.
   */
  file: string | null;

  /**
   * Whether default browser launch arguments (to disable features that may
   * make debugging harder) will be included in the launch.
   */
  includeDefaultArgs: boolean;

  /**
   * Whether any default launch/debugging arguments are set on the browser.
   * The debugger will assume the browser will use pipe debugging such as that
   * which is provided with `--remote-debugging-pipe`. For advanced use cases.
   */
  includeLaunchArgs: boolean;

  /**
   * Additional browser command line arguments.
   */
  runtimeArgs: ReadonlyArray<string> | null;

  /**
   * Either 'canary', 'stable', 'beta', 'dev', 'custom' or path to the browser executable.
   * Custom means a custom wrapper, custom build or CHROME_PATH
   * environment variable.
   */
  runtimeExecutable: string | null;

  /**
   * By default, Chrome is launched with a separate user profile in a temp
   * folder. Use this option to override it. Set to false to launch
   * with your default user profile.
   */
  userDataDir: string | boolean;

  /**
   * The debug adapter is running elevated. Launch Chrome unelevated to avoid the security restrictions of running Chrome elevated
   */
  launchUnelevated?: boolean;

  /**
   * Internal use only. Do not include in contrib.
   */
  skipNavigateForTest?: boolean;

  /**
   * Forces the browser to be launched in one location. In a remote workspace
   * (through ssh or WSL, for example) this can be used to open the browser
   * on the remote machine rather than locally.
   */
  browserLaunchLocation: 'workspace' | 'ui' | null;

  /**
   * If true, will start profiling soon as the page launches.
   */
  profileStartup: boolean;

  /**
   * Close whole browser or just the tab when cleaning up
   */
  cleanUp: 'wholeBrowser' | 'onlyTab';
}

/**
 * Configuration to launch to a Chrome instance.
 */
export interface IChromeLaunchConfiguration extends IChromiumLaunchConfiguration {
  type: DebugType.Chrome;
  __pendingTargetId?: string;
}

export interface IChromiumAttachConfiguration extends IChromiumBaseConfiguration {
  request: 'attach';

  /**
   * TCP/IP address of process to be debugged (for Node.js >= 5.0 only).
   * Default is 'localhost'.
   */
  address: string;

  /**
   * Debug port to attach to. Default is 9229.
   */
  port: number;

  /**
   * Whether to restart whe attachment is lost.
   */
  restart: boolean;

  /**
   * Whether to attach to all targets that match the URL filter ("automatic")
   * or ask the user to pick one ("pick").
   */
  targetSelection: 'pick' | 'automatic';

  /**
   * Forces the browser to attach in one location. In a remote workspace
   * (through ssh or WSL, for example) this can be used to attach to a browser
   * on the remote machine rather than locally.
   */
  browserAttachLocation: 'workspace' | 'ui' | null;
}

/**
 * Configuration to attach to a Chrome instance.
 */
export interface IChromeAttachConfiguration extends IChromiumAttachConfiguration {
  type: DebugType.Chrome;
  restart: boolean;
  __pendingTargetId?: string;
}

/**
 * Fake 'attach' config used in the binder.
 */
export interface IPseudoAttachConfiguration extends IMandatedConfiguration {
  type: DebugType;
  request: 'attach' | 'launch';
  __pendingTargetId: string;
  preLaunchTask?: string;
  postDebugTask?: string;
  preRestartTask?: string;
  postRestartTask?: string;
}

/**
 * Configuration to launch to a Edge instance.
 */
export interface IEdgeLaunchConfiguration extends IChromiumLaunchConfiguration {
  type: DebugType.Edge;

  /**
   * Enable web view debugging.
   */
  useWebView: boolean;

  /**
   * TCP/IP address of webview to be debugged. Default is 'localhost'.
   */
  address?: string;
}

/**
 * Configuration to attach to a Edge instance.
 */
export interface IEdgeAttachConfiguration extends IChromiumAttachConfiguration {
  type: DebugType.Edge;
  request: 'attach';
  useWebView: boolean | { pipeName: string };
}

/**
 * Attach request used internally to inject a pre-built target into the lifecycle.
 */
export interface ITerminalDelegateConfiguration extends INodeBaseConfiguration {
  type: DebugType.Terminal;
  request: 'attach';
  delegateId: number;
}

export type AnyNodeConfiguration =
  | INodeAttachConfiguration
  | INodeLaunchConfiguration
  | ITerminalLaunchConfiguration
  | IExtensionHostLaunchConfiguration
  | IExtensionHostAttachConfiguration
  | ITerminalDelegateConfiguration;
export type AnyChromeConfiguration = IChromeAttachConfiguration | IChromeLaunchConfiguration;
export type AnyEdgeConfiguration = IEdgeAttachConfiguration | IEdgeLaunchConfiguration;
export type AnyChromiumLaunchConfiguration = IEdgeLaunchConfiguration | IChromeLaunchConfiguration;
export type AnyChromiumAttachConfiguration = IEdgeAttachConfiguration | IChromeAttachConfiguration;
export type AnyChromiumConfiguration = AnyEdgeConfiguration | AnyChromeConfiguration;
export type AnyLaunchConfiguration = AnyChromiumConfiguration | AnyNodeConfiguration;
export type AnyTerminalConfiguration =
  | ITerminalDelegateConfiguration
  | ITerminalLaunchConfiguration;

/**
 * Where T subtypes AnyLaunchConfiguration, gets the resolving version of T.
 */
export type ResolvingConfiguration<T> = IMandatedConfiguration & Partial<T>;

export type ResolvingExtensionHostConfiguration = ResolvingConfiguration<
  IExtensionHostLaunchConfiguration
>;
export type ResolvingNodeAttachConfiguration = ResolvingConfiguration<INodeAttachConfiguration>;
export type ResolvingNodeLaunchConfiguration = ResolvingConfiguration<INodeLaunchConfiguration>;
export type ResolvingTerminalDelegateConfiguration = ResolvingConfiguration<
  ITerminalDelegateConfiguration
>;
export type ResolvingTerminalLaunchConfiguration = ResolvingConfiguration<
  ITerminalLaunchConfiguration
>;
export type ResolvingTerminalConfiguration =
  | ResolvingTerminalDelegateConfiguration
  | ResolvingTerminalLaunchConfiguration;
export type ResolvingNodeConfiguration =
  | ResolvingNodeAttachConfiguration
  | ResolvingNodeLaunchConfiguration;
export type ResolvingChromeConfiguration = ResolvingConfiguration<AnyChromeConfiguration>;
export type ResolvingEdgeConfiguration = ResolvingConfiguration<AnyEdgeConfiguration>;
export type AnyResolvingConfiguration =
  | ResolvingExtensionHostConfiguration
  | ResolvingChromeConfiguration
  | ResolvingNodeAttachConfiguration
  | ResolvingNodeLaunchConfiguration
  | ResolvingTerminalConfiguration
  | ResolvingEdgeConfiguration;

export const AnyLaunchConfiguration = Symbol('AnyLaunchConfiguration');

/**
 * Where T subtypes AnyResolvingConfiguration, gets the resolved version of T.
 */
export type ResolvedConfiguration<T> = T extends ResolvingNodeAttachConfiguration
  ? INodeAttachConfiguration
  : T extends ResolvingExtensionHostConfiguration ? IExtensionHostLaunchConfiguration
  : T extends ResolvingNodeLaunchConfiguration ? INodeLaunchConfiguration
  : T extends ResolvingChromeConfiguration ? AnyChromeConfiguration
  : T extends ResolvingTerminalConfiguration ? ITerminalLaunchConfiguration
  : never;

export const baseDefaults: IBaseConfiguration = {
  type: '',
  name: '',
  request: '',
  trace: false,
  outputCapture: OutputSource.Console,
  timeout: 10000,
  timeouts: {},
  showAsyncStacks: true,
  skipFiles: [],
  smartStep: true,
  sourceMaps: true,
  sourceMapRenames: true,
  pauseForSourceMap: true,
  resolveSourceMapLocations: null,
  rootPath: '${workspaceFolder}',
  outFiles: ['${workspaceFolder}/**/*.(m|c|)js', '!**/node_modules/**'],
  sourceMapPathOverrides: defaultSourceMapPathOverrides('${workspaceFolder}'),
  enableContentValidation: true,
  cascadeTerminateToConfigurations: [],
  enableDWARF: true,
  // Should always be determined upstream;
  __workspaceFolder: '',
  __remoteFilePrefix: undefined,
  __breakOnConditionalError: false,
  customDescriptionGenerator: undefined,
  customPropertiesGenerator: undefined,
};

const nodeBaseDefaults: INodeBaseConfiguration = {
  ...baseDefaults,
  cwd: '${workspaceFolder}',
  env: {},
  envFile: null,
  pauseForSourceMap: false,
  sourceMaps: true,
  localRoot: null,
  remoteRoot: null,
  resolveSourceMapLocations: ['**', '!**/node_modules/**'],
  autoAttachChildProcesses: true,
  runtimeSourcemapPausePatterns: [],
  skipFiles: [`${nodeInternalsToken}/**`],
};

export const terminalBaseDefaults: ITerminalLaunchConfiguration = {
  ...nodeBaseDefaults,
  showAsyncStacks: { onceBreakpointResolved: 16 },
  type: DebugType.Terminal,
  request: 'launch',
  name: 'JavaScript Debug Terminal',
};

export const delegateDefaults: ITerminalDelegateConfiguration = {
  ...nodeBaseDefaults,
  type: DebugType.Terminal,
  request: 'attach',
  name: terminalBaseDefaults.name,
  showAsyncStacks: { onceBreakpointResolved: 16 },
  delegateId: -1,
};

export const extensionHostConfigDefaults: IExtensionHostLaunchConfiguration = {
  ...nodeBaseDefaults,
  type: DebugType.ExtensionHost,
  name: 'Debug Extension',
  request: 'launch',
  args: ['--extensionDevelopmentPath=${workspaceFolder}'],
  env: { VSCODE_EXTENSION_DEVELOPMENT_PATH: '${workspaceFolder}' },
  outFiles: ['${workspaceFolder}/out/**/*.js'],
  resolveSourceMapLocations: ['${workspaceFolder}/**', '!**/node_modules/**'],
  rendererDebugOptions: {},
  runtimeExecutable: '${execPath}',
  skipFiles: [
    '<node_internals>/**',
    '${execInstallFolder}/**',
    '${workspaceFolder}/**/node_modules/**'
  ],
  autoAttachChildProcesses: false,
  debugWebviews: false,
  debugWebWorkerHost: false,
  __sessionId: '',
};

export const nodeLaunchConfigDefaults: INodeLaunchConfiguration = {
  ...nodeBaseDefaults,
  type: DebugType.Node,
  request: 'launch',
  program: '',
  cwd: '${workspaceFolder}',
  stopOnEntry: false,
  console: 'internalConsole',
  restart: false,
  args: [],
  runtimeExecutable: 'node',
  runtimeVersion: 'default',
  runtimeArgs: [],
  profileStartup: false,
  attachSimplePort: null,
  experimentalNetworking: 'auto',
  killBehavior: KillBehavior.Forceful,
};

export const chromeAttachConfigDefaults: IChromeAttachConfiguration = {
  ...baseDefaults,
  type: DebugType.Chrome,
  request: 'attach',
  address: 'localhost',
  port: 0,
  disableNetworkCache: true,
  pathMapping: {},
  url: null,
  restart: false,
  urlFilter: '',
  sourceMapPathOverrides: defaultSourceMapPathOverrides('${webRoot}'),
  webRoot: '${workspaceFolder}',
  server: null,
  browserAttachLocation: 'workspace',
  targetSelection: 'automatic',
  vueComponentPaths: ['${workspaceFolder}/**/*.vue', '!**/node_modules/**'],
  perScriptSourcemaps: 'auto',
};

export const edgeAttachConfigDefaults: IEdgeAttachConfiguration = {
  ...chromeAttachConfigDefaults,
  type: DebugType.Edge,
  useWebView: false,
};

export const chromeLaunchConfigDefaults: IChromeLaunchConfiguration = {
  ...chromeAttachConfigDefaults,
  type: DebugType.Chrome,
  request: 'launch',
  cwd: null,
  file: null,
  env: {},
  urlFilter: '*',
  includeDefaultArgs: true,
  includeLaunchArgs: true,
  runtimeArgs: null,
  runtimeExecutable: '*',
  userDataDir: true,
  browserLaunchLocation: 'workspace',
  profileStartup: false,
  cleanUp: 'wholeBrowser',
};

export const edgeLaunchConfigDefaults: IEdgeLaunchConfiguration = {
  ...chromeLaunchConfigDefaults,
  type: DebugType.Edge,
  useWebView: false,
};

export const nodeAttachConfigDefaults: INodeAttachConfiguration = {
  ...nodeBaseDefaults,
  type: DebugType.Node,
  attachExistingChildren: true,
  address: 'localhost',
  port: 9229,
  restart: false,
  request: 'attach',
  continueOnAttach: false,
};

export function defaultSourceMapPathOverrides(webRoot: string): { [key: string]: string } {
  return {
    'webpack:///./~/*': `${webRoot}/node_modules/*`,
    'webpack:////*': '/*',
    'webpack://@?:*/?:*/*': `${webRoot}/*`,
    'webpack://?:*/*': `${webRoot}/*`,
    'webpack:///([a-z]):/(.+)': '$1:/$2',
    'meteor://💻app/*': `${webRoot}/*`,
    'turbopack://[project]/*': '${workspaceFolder}/*',
  };
}

export const applyNodeishDefaults = (
  config:
    | ResolvingNodeConfiguration
    | ResolvingTerminalConfiguration
    | ResolvingExtensionHostConfiguration,
) => {
  if (!config.sourceMapPathOverrides && config.cwd) {
    config.sourceMapPathOverrides = defaultSourceMapPathOverrides(config.cwd);
  }

  // Resolve source map locations from the outFiles by default:
  // https://github.com/microsoft/vscode-js-debug/issues/704
  if (config.resolveSourceMapLocations === undefined) {
    config.resolveSourceMapLocations = config.outFiles;
  }
};

export function applyNodeDefaults(
  { ...config }: ResolvingNodeConfiguration,
): AnyNodeConfiguration {
  applyNodeishDefaults(config);
  if (config.request === 'attach') {
    return { ...nodeAttachConfigDefaults, ...config };
  } else {
    return { ...nodeLaunchConfigDefaults, ...config };
  }
}

export function applyChromeDefaults(
  config: ResolvingChromeConfiguration,
  browserLocation: 'workspace' | 'ui',
): AnyChromeConfiguration {
  return config.request === 'attach'
    ? { ...chromeAttachConfigDefaults, browserAttachLocation: browserLocation, ...config }
    : { ...chromeLaunchConfigDefaults, browserLaunchLocation: browserLocation, ...config };
}

export function applyEdgeDefaults(
  config: ResolvingEdgeConfiguration,
  browserLocation: 'workspace' | 'ui',
): AnyEdgeConfiguration {
  return config.request === 'attach'
    ? { ...edgeAttachConfigDefaults, browserAttachLocation: browserLocation, ...config }
    : { ...edgeLaunchConfigDefaults, browserLaunchLocation: browserLocation, ...config };
}

export function applyExtensionHostDefaults(
  config: ResolvingExtensionHostConfiguration,
): IExtensionHostLaunchConfiguration {
  const resolved = { ...extensionHostConfigDefaults, ...config };
  resolved.skipFiles = [...resolved.skipFiles, '**/node_modules.asar/**', '**/bootstrap-fork.js'];
  return resolved;
}

export function applyTerminalDefaults(
  config: ResolvingTerminalConfiguration,
): AnyTerminalConfiguration {
  applyNodeishDefaults(config);
  return config.request === 'launch'
    ? { ...terminalBaseDefaults, ...config }
    : { ...delegateDefaults, ...config };
}

export const isConfigurationWithEnv = (config: unknown): config is IConfigurationWithEnv =>
  typeof config === 'object' && !!config && 'env' in config && 'envFile' in config;

export function applyDefaults(
  config: AnyResolvingConfiguration,
  location?: 'local' | 'remote',
): AnyLaunchConfiguration {
  let configWithDefaults: AnyLaunchConfiguration;
  const defaultBrowserLocation = location === 'remote' ? ('ui' as const) : ('workspace' as const);
  switch (config.type) {
    case DebugType.Node:
      configWithDefaults = applyNodeDefaults(config);
      break;
    case DebugType.Edge:
      configWithDefaults = applyEdgeDefaults(config, defaultBrowserLocation);
      break;
    case DebugType.Chrome:
      configWithDefaults = applyChromeDefaults(config, defaultBrowserLocation);
      break;
    case DebugType.ExtensionHost:
      configWithDefaults = applyExtensionHostDefaults(config);
      break;
    case DebugType.Terminal:
      configWithDefaults = applyTerminalDefaults(config);
      break;
    default:
      throw assertNever(config, 'Unknown config: {value}');
  }

  return resolveWorkspaceInConfig(configWithDefaults);
}

/**
 * Removes optional properties from the config where ${workspaceFolder} is
 * used by default. This enables some limited types of debugging without
 * workspaces set.
 */
export function removeOptionalWorkspaceFolderUsages<T extends AnyLaunchConfiguration>(
  config: T,
): T {
  const token = '${workspaceFolder}';
  const cast: AnyLaunchConfiguration = {
    ...config,
    rootPath: undefined,
    outFiles: config.outFiles.filter(o => !o.includes(token)),
    sourceMapPathOverrides: filterValues(
      config.sourceMapPathOverrides,
      (v): v is string => !v.includes('${workspaceFolder}'),
    ),
  };

  if ('vueComponentPaths' in cast) {
    cast.vueComponentPaths = cast.vueComponentPaths.filter(o => !o.includes(token));
  }

  if ('resolveSourceMapLocations' in cast) {
    cast.resolveSourceMapLocations = cast.resolveSourceMapLocations?.filter(o => !o.includes(token))
      ?? null;
  }

  if ('cwd' in cast && cast.cwd?.includes(token)) {
    // cwd is required (only) for node launch types
    cast.cwd = cast.request === 'launch' && cast.type === DebugType.Node ? homedir() : undefined;
  }

  if ('webRoot' in cast && cast.webRoot?.includes(token)) {
    cast.webRoot = '/';
  }

  return cast as T;
}

export function resolveWorkspaceInConfig<T extends AnyLaunchConfiguration>(config: T): T {
  if (!config.__workspaceFolder) {
    config = removeOptionalWorkspaceFolderUsages(config);
  }

  config = resolveVariableInConfig(config, 'workspaceFolder', config.__workspaceFolder);
  config = resolveVariableInConfig(
    config,
    'webRoot',
    'webRoot' in config ? (config as AnyChromiumConfiguration).webRoot : config.__workspaceFolder,
  );

  return config;
}

export function resolveVariableInConfig<T>(
  config: T,
  varName: string,
  varValue: string | undefined,
): T {
  let out: unknown;
  if (typeof config === 'string') {
    out = config.replace(new RegExp(`\\$\\{${varName}\\}`, 'g'), () => {
      if (!varValue) {
        throw new Error(
          `Unable to resolve \${${varName}} in configuration (${JSON.stringify(varName)})`,
        );
      }
      return varValue;
    });
  } else if (config instanceof Array) {
    out = config.map(cfg => resolveVariableInConfig(cfg, varName, varValue));
  } else if (typeof config === 'object' && config) {
    const obj: { [key: string]: unknown } = {};
    for (const [key, value] of Object.entries(config)) {
      obj[resolveVariableInConfig(key, varName, varValue)] = resolveVariableInConfig(
        value,
        varName,
        varValue,
      );
    }
    out = obj;
  } else {
    out = config;
  }

  return out as T;
}

export const breakpointLanguages: ReadonlyArray<string> = [
  'javascript',
  'typescript',
  'typescriptreact',
  'javascriptreact',
  'fsharp',
  'html',
  'wat',
  // Common wasm languages:
  'c',
  'cpp',
  'rust',
  'zig',
];

declare const EXTENSION_NAME: string;
declare const EXTENSION_VERSION: string;
declare const EXTENSION_PUBLISHER: string;

export const packageName = typeof EXTENSION_NAME !== 'undefined' ? EXTENSION_NAME : 'js-debug';
export const packageVersion = typeof EXTENSION_VERSION !== 'undefined'
  ? EXTENSION_VERSION
  : '0.0.0';
export const packagePublisher = typeof EXTENSION_PUBLISHER !== 'undefined'
  ? EXTENSION_PUBLISHER
  : 'vscode-samples';
export const isNightly = packageName.includes('nightly');
export const extensionId = `${packagePublisher}.${packageName}`;
