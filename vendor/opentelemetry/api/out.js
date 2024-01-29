// $ npx esbuild src/index.ts --bundle --outfile=out.js
// TODO: Configure `esbuild` to export ESM module
"use strict";
// PATCH
export default (() => {
  // src/platform/browser/globalThis.ts
  var _globalThis = typeof globalThis === "object" ? globalThis : typeof self === "object" ? self : typeof window === "object" ? window : typeof global === "object" ? global : {};

  // src/version.ts
  var VERSION = "1.7.0";

  // src/internal/semver.ts
  var re = /^(\d+)\.(\d+)\.(\d+)(-(.+))?$/;
  function _makeCompatibilityCheck(ownVersion) {
    const acceptedVersions = /* @__PURE__ */ new Set([ownVersion]);
    const rejectedVersions = /* @__PURE__ */ new Set();
    const myVersionMatch = ownVersion.match(re);
    if (!myVersionMatch) {
      return () => false;
    }
    const ownVersionParsed = {
      major: +myVersionMatch[1],
      minor: +myVersionMatch[2],
      patch: +myVersionMatch[3],
      prerelease: myVersionMatch[4]
    };
    if (ownVersionParsed.prerelease != null) {
      return function isExactmatch(globalVersion) {
        return globalVersion === ownVersion;
      };
    }
    function _reject(v) {
      rejectedVersions.add(v);
      return false;
    }
    function _accept(v) {
      acceptedVersions.add(v);
      return true;
    }
    return function isCompatible2(globalVersion) {
      if (acceptedVersions.has(globalVersion)) {
        return true;
      }
      if (rejectedVersions.has(globalVersion)) {
        return false;
      }
      const globalVersionMatch = globalVersion.match(re);
      if (!globalVersionMatch) {
        return _reject(globalVersion);
      }
      const globalVersionParsed = {
        major: +globalVersionMatch[1],
        minor: +globalVersionMatch[2],
        patch: +globalVersionMatch[3],
        prerelease: globalVersionMatch[4]
      };
      if (globalVersionParsed.prerelease != null) {
        return _reject(globalVersion);
      }
      if (ownVersionParsed.major !== globalVersionParsed.major) {
        return _reject(globalVersion);
      }
      if (ownVersionParsed.major === 0) {
        if (ownVersionParsed.minor === globalVersionParsed.minor && ownVersionParsed.patch <= globalVersionParsed.patch) {
          return _accept(globalVersion);
        }
        return _reject(globalVersion);
      }
      if (ownVersionParsed.minor <= globalVersionParsed.minor) {
        return _accept(globalVersion);
      }
      return _reject(globalVersion);
    };
  }
  var isCompatible = _makeCompatibilityCheck(VERSION);

  // src/internal/global-utils.ts
  var major = VERSION.split(".")[0];
  var GLOBAL_OPENTELEMETRY_API_KEY = Symbol.for(
    `opentelemetry.js.api.${major}`
  );
  var _global = _globalThis;
  function registerGlobal(type, instance, diag3, allowOverride = false) {
    const api = _global[GLOBAL_OPENTELEMETRY_API_KEY] = _global[GLOBAL_OPENTELEMETRY_API_KEY] ?? {
      version: VERSION
    };
    if (!allowOverride && api[type]) {
      const err = new Error(
        `@opentelemetry/api: Attempted duplicate registration of API: ${type}`
      );
      diag3.error(err.stack || err.message);
      return false;
    }
    if (api.version !== VERSION) {
      const err = new Error(
        `@opentelemetry/api: Registration of version v${api.version} for ${type} does not match previously registered API v${VERSION}`
      );
      diag3.error(err.stack || err.message);
      return false;
    }
    api[type] = instance;
    diag3.debug(
      `@opentelemetry/api: Registered a global for ${type} v${VERSION}.`
    );
    return true;
  }
  function getGlobal(type) {
    const globalVersion = _global[GLOBAL_OPENTELEMETRY_API_KEY]?.version;
    if (!globalVersion || !isCompatible(globalVersion)) {
      return;
    }
    return _global[GLOBAL_OPENTELEMETRY_API_KEY]?.[type];
  }
  function unregisterGlobal(type, diag3) {
    diag3.debug(
      `@opentelemetry/api: Unregistering a global for ${type} v${VERSION}.`
    );
    const api = _global[GLOBAL_OPENTELEMETRY_API_KEY];
    if (api) {
      delete api[type];
    }
  }

  // src/diag/ComponentLogger.ts
  var DiagComponentLogger = class {
    constructor(props) {
      this._namespace = props.namespace || "DiagComponentLogger";
    }
    debug(...args) {
      return logProxy("debug", this._namespace, args);
    }
    error(...args) {
      return logProxy("error", this._namespace, args);
    }
    info(...args) {
      return logProxy("info", this._namespace, args);
    }
    warn(...args) {
      return logProxy("warn", this._namespace, args);
    }
    verbose(...args) {
      return logProxy("verbose", this._namespace, args);
    }
  };
  function logProxy(funcName, namespace, args) {
    const logger = getGlobal("diag");
    if (!logger) {
      return;
    }
    args.unshift(namespace);
    return logger[funcName](...args);
  }

  // src/diag/types.ts
  var DiagLogLevel = /* @__PURE__ */ ((DiagLogLevel2) => {
    DiagLogLevel2[DiagLogLevel2["NONE"] = 0] = "NONE";
    DiagLogLevel2[DiagLogLevel2["ERROR"] = 30] = "ERROR";
    DiagLogLevel2[DiagLogLevel2["WARN"] = 50] = "WARN";
    DiagLogLevel2[DiagLogLevel2["INFO"] = 60] = "INFO";
    DiagLogLevel2[DiagLogLevel2["DEBUG"] = 70] = "DEBUG";
    DiagLogLevel2[DiagLogLevel2["VERBOSE"] = 80] = "VERBOSE";
    DiagLogLevel2[DiagLogLevel2["ALL"] = 9999] = "ALL";
    return DiagLogLevel2;
  })(DiagLogLevel || {});

  // src/diag/internal/logLevelLogger.ts
  function createLogLevelDiagLogger(maxLevel, logger) {
    if (maxLevel < 0 /* NONE */) {
      maxLevel = 0 /* NONE */;
    } else if (maxLevel > 9999 /* ALL */) {
      maxLevel = 9999 /* ALL */;
    }
    logger = logger || {};
    function _filterFunc(funcName, theLevel) {
      const theFunc = logger[funcName];
      if (typeof theFunc === "function" && maxLevel >= theLevel) {
        return theFunc.bind(logger);
      }
      return function() {
      };
    }
    return {
      error: _filterFunc("error", 30 /* ERROR */),
      warn: _filterFunc("warn", 50 /* WARN */),
      info: _filterFunc("info", 60 /* INFO */),
      debug: _filterFunc("debug", 70 /* DEBUG */),
      verbose: _filterFunc("verbose", 80 /* VERBOSE */)
    };
  }

  // src/api/diag.ts
  var API_NAME = "diag";
  var DiagAPI = class _DiagAPI {
    /** Get the singleton instance of the DiagAPI API */
    static instance() {
      if (!this._instance) {
        this._instance = new _DiagAPI();
      }
      return this._instance;
    }
    /**
     * Private internal constructor
     * @private
     */
    constructor() {
      function _logProxy(funcName) {
        return function(...args) {
          const logger = getGlobal("diag");
          if (!logger)
            return;
          return logger[funcName](...args);
        };
      }
      const self2 = this;
      const setLogger = (logger, optionsOrLogLevel = { logLevel: 60 /* INFO */ }) => {
        if (logger === self2) {
          const err = new Error(
            "Cannot use diag as the logger for itself. Please use a DiagLogger implementation like ConsoleDiagLogger or a custom implementation"
          );
          self2.error(err.stack ?? err.message);
          return false;
        }
        if (typeof optionsOrLogLevel === "number") {
          optionsOrLogLevel = {
            logLevel: optionsOrLogLevel
          };
        }
        const oldLogger = getGlobal("diag");
        const newLogger = createLogLevelDiagLogger(
          optionsOrLogLevel.logLevel ?? 60 /* INFO */,
          logger
        );
        if (oldLogger && !optionsOrLogLevel.suppressOverrideMessage) {
          const stack = new Error().stack ?? "<failed to generate stacktrace>";
          oldLogger.warn(`Current logger will be overwritten from ${stack}`);
          newLogger.warn(
            `Current logger will overwrite one already registered from ${stack}`
          );
        }
        return registerGlobal("diag", newLogger, self2, true);
      };
      self2.setLogger = setLogger;
      self2.disable = () => {
        unregisterGlobal(API_NAME, self2);
      };
      self2.createComponentLogger = (options) => {
        return new DiagComponentLogger(options);
      };
      self2.verbose = _logProxy("verbose");
      self2.debug = _logProxy("debug");
      self2.info = _logProxy("info");
      self2.warn = _logProxy("warn");
      self2.error = _logProxy("error");
    }
  };

  // src/baggage/internal/baggage-impl.ts
  var BaggageImpl = class _BaggageImpl {
    constructor(entries) {
      this._entries = entries ? new Map(entries) : /* @__PURE__ */ new Map();
    }
    getEntry(key) {
      const entry = this._entries.get(key);
      if (!entry) {
        return void 0;
      }
      return Object.assign({}, entry);
    }
    getAllEntries() {
      return Array.from(this._entries.entries()).map(([k, v]) => [k, v]);
    }
    setEntry(key, entry) {
      const newBaggage = new _BaggageImpl(this._entries);
      newBaggage._entries.set(key, entry);
      return newBaggage;
    }
    removeEntry(key) {
      const newBaggage = new _BaggageImpl(this._entries);
      newBaggage._entries.delete(key);
      return newBaggage;
    }
    removeEntries(...keys) {
      const newBaggage = new _BaggageImpl(this._entries);
      for (const key of keys) {
        newBaggage._entries.delete(key);
      }
      return newBaggage;
    }
    clear() {
      return new _BaggageImpl();
    }
  };

  // src/baggage/internal/symbol.ts
  var baggageEntryMetadataSymbol = Symbol("BaggageEntryMetadata");

  // src/baggage/utils.ts
  var diag = DiagAPI.instance();
  function createBaggage(entries = {}) {
    return new BaggageImpl(new Map(Object.entries(entries)));
  }
  function baggageEntryMetadataFromString(str) {
    if (typeof str !== "string") {
      diag.error(
        `Cannot create baggage metadata from unknown type: ${typeof str}`
      );
      str = "";
    }
    return {
      __TYPE__: baggageEntryMetadataSymbol,
      toString() {
        return str;
      }
    };
  }

  // src/context/context.ts
  function createContextKey(description) {
    return Symbol.for(description);
  }
  var BaseContext = class _BaseContext {
    /**
     * Construct a new context which inherits values from an optional parent context.
     *
     * @param parentContext a context from which to inherit values
     */
    constructor(parentContext) {
      const self2 = this;
      self2._currentContext = parentContext ? new Map(parentContext) : /* @__PURE__ */ new Map();
      self2.getValue = (key) => self2._currentContext.get(key);
      self2.setValue = (key, value) => {
        const context2 = new _BaseContext(self2._currentContext);
        context2._currentContext.set(key, value);
        return context2;
      };
      self2.deleteValue = (key) => {
        const context2 = new _BaseContext(self2._currentContext);
        context2._currentContext.delete(key);
        return context2;
      };
    }
  };
  var ROOT_CONTEXT = new BaseContext();

  // src/diag/consoleLogger.ts
  var consoleMap = [
    { n: "error", c: "error" },
    { n: "warn", c: "warn" },
    { n: "info", c: "info" },
    { n: "debug", c: "debug" },
    { n: "verbose", c: "trace" }
  ];
  var DiagConsoleLogger = class {
    constructor() {
      function _consoleFunc(funcName) {
        return function(...args) {
          if (console) {
            let theFunc = console[funcName];
            if (typeof theFunc !== "function") {
              theFunc = console.log;
            }
            if (typeof theFunc === "function") {
              return theFunc.apply(console, args);
            }
          }
        };
      }
      for (let i = 0; i < consoleMap.length; i++) {
        this[consoleMap[i].n] = _consoleFunc(consoleMap[i].c);
      }
    }
  };

  // src/metrics/NoopMeter.ts
  var NoopMeter = class {
    constructor() {
    }
    /**
     * @see {@link Meter.createHistogram}
     */
    createHistogram(_name, _options) {
      return NOOP_HISTOGRAM_METRIC;
    }
    /**
     * @see {@link Meter.createCounter}
     */
    createCounter(_name, _options) {
      return NOOP_COUNTER_METRIC;
    }
    /**
     * @see {@link Meter.createUpDownCounter}
     */
    createUpDownCounter(_name, _options) {
      return NOOP_UP_DOWN_COUNTER_METRIC;
    }
    /**
     * @see {@link Meter.createObservableGauge}
     */
    createObservableGauge(_name, _options) {
      return NOOP_OBSERVABLE_GAUGE_METRIC;
    }
    /**
     * @see {@link Meter.createObservableCounter}
     */
    createObservableCounter(_name, _options) {
      return NOOP_OBSERVABLE_COUNTER_METRIC;
    }
    /**
     * @see {@link Meter.createObservableUpDownCounter}
     */
    createObservableUpDownCounter(_name, _options) {
      return NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC;
    }
    /**
     * @see {@link Meter.addBatchObservableCallback}
     */
    addBatchObservableCallback(_callback, _observables) {
    }
    /**
     * @see {@link Meter.removeBatchObservableCallback}
     */
    removeBatchObservableCallback(_callback) {
    }
  };
  var NoopMetric = class {
  };
  var NoopCounterMetric = class extends NoopMetric {
    add(_value, _attributes) {
    }
  };
  var NoopUpDownCounterMetric = class extends NoopMetric {
    add(_value, _attributes) {
    }
  };
  var NoopHistogramMetric = class extends NoopMetric {
    record(_value, _attributes) {
    }
  };
  var NoopObservableMetric = class {
    addCallback(_callback) {
    }
    removeCallback(_callback) {
    }
  };
  var NoopObservableCounterMetric = class extends NoopObservableMetric {
  };
  var NoopObservableGaugeMetric = class extends NoopObservableMetric {
  };
  var NoopObservableUpDownCounterMetric = class extends NoopObservableMetric {
  };
  var NOOP_METER = new NoopMeter();
  var NOOP_COUNTER_METRIC = new NoopCounterMetric();
  var NOOP_HISTOGRAM_METRIC = new NoopHistogramMetric();
  var NOOP_UP_DOWN_COUNTER_METRIC = new NoopUpDownCounterMetric();
  var NOOP_OBSERVABLE_COUNTER_METRIC = new NoopObservableCounterMetric();
  var NOOP_OBSERVABLE_GAUGE_METRIC = new NoopObservableGaugeMetric();
  var NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC = new NoopObservableUpDownCounterMetric();
  function createNoopMeter() {
    return NOOP_METER;
  }

  // src/metrics/Metric.ts
  var ValueType = /* @__PURE__ */ ((ValueType2) => {
    ValueType2[ValueType2["INT"] = 0] = "INT";
    ValueType2[ValueType2["DOUBLE"] = 1] = "DOUBLE";
    return ValueType2;
  })(ValueType || {});

  // src/propagation/TextMapPropagator.ts
  var defaultTextMapGetter = {
    get(carrier, key) {
      if (carrier == null) {
        return void 0;
      }
      return carrier[key];
    },
    keys(carrier) {
      if (carrier == null) {
        return [];
      }
      return Object.keys(carrier);
    }
  };
  var defaultTextMapSetter = {
    set(carrier, key, value) {
      if (carrier == null) {
        return;
      }
      carrier[key] = value;
    }
  };

  // src/context/NoopContextManager.ts
  var NoopContextManager = class {
    active() {
      return ROOT_CONTEXT;
    }
    with(_context, fn, thisArg, ...args) {
      return fn.call(thisArg, ...args);
    }
    bind(_context, target) {
      return target;
    }
    enable() {
      return this;
    }
    disable() {
      return this;
    }
  };

  // src/api/context.ts
  var API_NAME2 = "context";
  var NOOP_CONTEXT_MANAGER = new NoopContextManager();
  var ContextAPI = class _ContextAPI {
    /** Empty private constructor prevents end users from constructing a new instance of the API */
    constructor() {
    }
    /** Get the singleton instance of the Context API */
    static getInstance() {
      if (!this._instance) {
        this._instance = new _ContextAPI();
      }
      return this._instance;
    }
    /**
     * Set the current context manager.
     *
     * @returns true if the context manager was successfully registered, else false
     */
    setGlobalContextManager(contextManager) {
      return registerGlobal(API_NAME2, contextManager, DiagAPI.instance());
    }
    /**
     * Get the currently active context
     */
    active() {
      return this._getContextManager().active();
    }
    /**
     * Execute a function with an active context
     *
     * @param context context to be active during function execution
     * @param fn function to execute in a context
     * @param thisArg optional receiver to be used for calling fn
     * @param args optional arguments forwarded to fn
     */
    with(context2, fn, thisArg, ...args) {
      return this._getContextManager().with(context2, fn, thisArg, ...args);
    }
    /**
     * Bind a context to a target function or event emitter
     *
     * @param context context to bind to the event emitter or function. Defaults to the currently active context
     * @param target function or event emitter to bind
     */
    bind(context2, target) {
      return this._getContextManager().bind(context2, target);
    }
    _getContextManager() {
      return getGlobal(API_NAME2) || NOOP_CONTEXT_MANAGER;
    }
    /** Disable and remove the global context manager */
    disable() {
      this._getContextManager().disable();
      unregisterGlobal(API_NAME2, DiagAPI.instance());
    }
  };

  // src/trace/trace_flags.ts
  var TraceFlags = /* @__PURE__ */ ((TraceFlags2) => {
    TraceFlags2[TraceFlags2["NONE"] = 0] = "NONE";
    TraceFlags2[TraceFlags2["SAMPLED"] = 1] = "SAMPLED";
    return TraceFlags2;
  })(TraceFlags || {});

  // src/trace/invalid-span-constants.ts
  var INVALID_SPANID = "0000000000000000";
  var INVALID_TRACEID = "00000000000000000000000000000000";
  var INVALID_SPAN_CONTEXT = {
    traceId: INVALID_TRACEID,
    spanId: INVALID_SPANID,
    traceFlags: 0 /* NONE */
  };

  // src/trace/NonRecordingSpan.ts
  var NonRecordingSpan = class {
    constructor(_spanContext = INVALID_SPAN_CONTEXT) {
      this._spanContext = _spanContext;
    }
    // Returns a SpanContext.
    spanContext() {
      return this._spanContext;
    }
    // By default does nothing
    setAttribute(_key, _value) {
      return this;
    }
    // By default does nothing
    setAttributes(_attributes) {
      return this;
    }
    // By default does nothing
    addEvent(_name, _attributes) {
      return this;
    }
    // By default does nothing
    setStatus(_status) {
      return this;
    }
    // By default does nothing
    updateName(_name) {
      return this;
    }
    // By default does nothing
    end(_endTime) {
    }
    // isRecording always returns false for NonRecordingSpan.
    isRecording() {
      return false;
    }
    // By default does nothing
    recordException(_exception, _time) {
    }
  };

  // src/trace/context-utils.ts
  var SPAN_KEY = createContextKey("OpenTelemetry Context Key SPAN");
  function getSpan(context2) {
    return context2.getValue(SPAN_KEY) || void 0;
  }
  function getActiveSpan() {
    return getSpan(ContextAPI.getInstance().active());
  }
  function setSpan(context2, span) {
    return context2.setValue(SPAN_KEY, span);
  }
  function deleteSpan(context2) {
    return context2.deleteValue(SPAN_KEY);
  }
  function setSpanContext(context2, spanContext) {
    return setSpan(context2, new NonRecordingSpan(spanContext));
  }
  function getSpanContext(context2) {
    return getSpan(context2)?.spanContext();
  }

  // src/trace/spancontext-utils.ts
  var VALID_TRACEID_REGEX = /^([0-9a-f]{32})$/i;
  var VALID_SPANID_REGEX = /^[0-9a-f]{16}$/i;
  function isValidTraceId(traceId) {
    return VALID_TRACEID_REGEX.test(traceId) && traceId !== INVALID_TRACEID;
  }
  function isValidSpanId(spanId) {
    return VALID_SPANID_REGEX.test(spanId) && spanId !== INVALID_SPANID;
  }
  function isSpanContextValid(spanContext) {
    return isValidTraceId(spanContext.traceId) && isValidSpanId(spanContext.spanId);
  }
  function wrapSpanContext(spanContext) {
    return new NonRecordingSpan(spanContext);
  }

  // src/trace/NoopTracer.ts
  var contextApi = ContextAPI.getInstance();
  var NoopTracer = class {
    // startSpan starts a noop span.
    startSpan(name, options, context2 = contextApi.active()) {
      const root = Boolean(options?.root);
      if (root) {
        return new NonRecordingSpan();
      }
      const parentFromContext = context2 && getSpanContext(context2);
      if (isSpanContext(parentFromContext) && isSpanContextValid(parentFromContext)) {
        return new NonRecordingSpan(parentFromContext);
      } else {
        return new NonRecordingSpan();
      }
    }
    startActiveSpan(name, arg2, arg3, arg4) {
      let opts;
      let ctx;
      let fn;
      if (arguments.length < 2) {
        return;
      } else if (arguments.length === 2) {
        fn = arg2;
      } else if (arguments.length === 3) {
        opts = arg2;
        fn = arg3;
      } else {
        opts = arg2;
        ctx = arg3;
        fn = arg4;
      }
      const parentContext = ctx ?? contextApi.active();
      const span = this.startSpan(name, opts, parentContext);
      const contextWithSpanSet = setSpan(parentContext, span);
      return contextApi.with(contextWithSpanSet, fn, void 0, span);
    }
  };
  function isSpanContext(spanContext) {
    return typeof spanContext === "object" && typeof spanContext["spanId"] === "string" && typeof spanContext["traceId"] === "string" && typeof spanContext["traceFlags"] === "number";
  }

  // src/trace/ProxyTracer.ts
  var NOOP_TRACER = new NoopTracer();
  var ProxyTracer = class {
    constructor(_provider, name, version, options) {
      this._provider = _provider;
      this.name = name;
      this.version = version;
      this.options = options;
    }
    startSpan(name, options, context2) {
      return this._getTracer().startSpan(name, options, context2);
    }
    startActiveSpan(_name, _options, _context, _fn) {
      const tracer = this._getTracer();
      return Reflect.apply(tracer.startActiveSpan, tracer, arguments);
    }
    /**
     * Try to get a tracer from the proxy tracer provider.
     * If the proxy tracer provider has no delegate, return a noop tracer.
     */
    _getTracer() {
      if (this._delegate) {
        return this._delegate;
      }
      const tracer = this._provider.getDelegateTracer(
        this.name,
        this.version,
        this.options
      );
      if (!tracer) {
        return NOOP_TRACER;
      }
      this._delegate = tracer;
      return this._delegate;
    }
  };

  // src/trace/NoopTracerProvider.ts
  var NoopTracerProvider = class {
    getTracer(_name, _version, _options) {
      return new NoopTracer();
    }
  };

  // src/trace/ProxyTracerProvider.ts
  var NOOP_TRACER_PROVIDER = new NoopTracerProvider();
  var ProxyTracerProvider = class {
    /**
     * Get a {@link ProxyTracer}
     */
    getTracer(name, version, options) {
      return this.getDelegateTracer(name, version, options) ?? new ProxyTracer(this, name, version, options);
    }
    getDelegate() {
      return this._delegate ?? NOOP_TRACER_PROVIDER;
    }
    /**
     * Set the delegate tracer provider
     */
    setDelegate(delegate) {
      this._delegate = delegate;
    }
    getDelegateTracer(name, version, options) {
      return this._delegate?.getTracer(name, version, options);
    }
  };

  // src/trace/SamplingResult.ts
  var SamplingDecision = /* @__PURE__ */ ((SamplingDecision2) => {
    SamplingDecision2[SamplingDecision2["NOT_RECORD"] = 0] = "NOT_RECORD";
    SamplingDecision2[SamplingDecision2["RECORD"] = 1] = "RECORD";
    SamplingDecision2[SamplingDecision2["RECORD_AND_SAMPLED"] = 2] = "RECORD_AND_SAMPLED";
    return SamplingDecision2;
  })(SamplingDecision || {});

  // src/trace/span_kind.ts
  var SpanKind = /* @__PURE__ */ ((SpanKind2) => {
    SpanKind2[SpanKind2["INTERNAL"] = 0] = "INTERNAL";
    SpanKind2[SpanKind2["SERVER"] = 1] = "SERVER";
    SpanKind2[SpanKind2["CLIENT"] = 2] = "CLIENT";
    SpanKind2[SpanKind2["PRODUCER"] = 3] = "PRODUCER";
    SpanKind2[SpanKind2["CONSUMER"] = 4] = "CONSUMER";
    return SpanKind2;
  })(SpanKind || {});

  // src/trace/status.ts
  var SpanStatusCode = /* @__PURE__ */ ((SpanStatusCode2) => {
    SpanStatusCode2[SpanStatusCode2["UNSET"] = 0] = "UNSET";
    SpanStatusCode2[SpanStatusCode2["OK"] = 1] = "OK";
    SpanStatusCode2[SpanStatusCode2["ERROR"] = 2] = "ERROR";
    return SpanStatusCode2;
  })(SpanStatusCode || {});

  // src/trace/internal/tracestate-validators.ts
  var VALID_KEY_CHAR_RANGE = "[_0-9a-z-*/]";
  var VALID_KEY = `[a-z]${VALID_KEY_CHAR_RANGE}{0,255}`;
  var VALID_VENDOR_KEY = `[a-z0-9]${VALID_KEY_CHAR_RANGE}{0,240}@[a-z]${VALID_KEY_CHAR_RANGE}{0,13}`;
  var VALID_KEY_REGEX = new RegExp(`^(?:${VALID_KEY}|${VALID_VENDOR_KEY})$`);
  var VALID_VALUE_BASE_REGEX = /^[ -~]{0,255}[!-~]$/;
  var INVALID_VALUE_COMMA_EQUAL_REGEX = /,|=/;
  function validateKey(key) {
    return VALID_KEY_REGEX.test(key);
  }
  function validateValue(value) {
    return VALID_VALUE_BASE_REGEX.test(value) && !INVALID_VALUE_COMMA_EQUAL_REGEX.test(value);
  }

  // src/trace/internal/tracestate-impl.ts
  var MAX_TRACE_STATE_ITEMS = 32;
  var MAX_TRACE_STATE_LEN = 512;
  var LIST_MEMBERS_SEPARATOR = ",";
  var LIST_MEMBER_KEY_VALUE_SPLITTER = "=";
  var TraceStateImpl = class _TraceStateImpl {
    constructor(rawTraceState) {
      this._internalState = /* @__PURE__ */ new Map();
      if (rawTraceState)
        this._parse(rawTraceState);
    }
    set(key, value) {
      const traceState = this._clone();
      if (traceState._internalState.has(key)) {
        traceState._internalState.delete(key);
      }
      traceState._internalState.set(key, value);
      return traceState;
    }
    unset(key) {
      const traceState = this._clone();
      traceState._internalState.delete(key);
      return traceState;
    }
    get(key) {
      return this._internalState.get(key);
    }
    serialize() {
      return this._keys().reduce((agg, key) => {
        agg.push(key + LIST_MEMBER_KEY_VALUE_SPLITTER + this.get(key));
        return agg;
      }, []).join(LIST_MEMBERS_SEPARATOR);
    }
    _parse(rawTraceState) {
      if (rawTraceState.length > MAX_TRACE_STATE_LEN)
        return;
      this._internalState = rawTraceState.split(LIST_MEMBERS_SEPARATOR).reverse().reduce((agg, part) => {
        const listMember = part.trim();
        const i = listMember.indexOf(LIST_MEMBER_KEY_VALUE_SPLITTER);
        if (i !== -1) {
          const key = listMember.slice(0, i);
          const value = listMember.slice(i + 1, part.length);
          if (validateKey(key) && validateValue(value)) {
            agg.set(key, value);
          } else {
          }
        }
        return agg;
      }, /* @__PURE__ */ new Map());
      if (this._internalState.size > MAX_TRACE_STATE_ITEMS) {
        this._internalState = new Map(
          Array.from(this._internalState.entries()).reverse().slice(0, MAX_TRACE_STATE_ITEMS)
        );
      }
    }
    _keys() {
      return Array.from(this._internalState.keys()).reverse();
    }
    _clone() {
      const traceState = new _TraceStateImpl();
      traceState._internalState = new Map(this._internalState);
      return traceState;
    }
  };

  // src/trace/internal/utils.ts
  function createTraceState(rawTraceState) {
    return new TraceStateImpl(rawTraceState);
  }

  // src/context-api.ts
  var context = ContextAPI.getInstance();

  // src/diag-api.ts
  var diag2 = DiagAPI.instance();

  // src/metrics/NoopMeterProvider.ts
  var NoopMeterProvider = class {
    getMeter(_name, _version, _options) {
      return NOOP_METER;
    }
  };
  var NOOP_METER_PROVIDER = new NoopMeterProvider();

  // src/api/metrics.ts
  var API_NAME3 = "metrics";
  var MetricsAPI = class _MetricsAPI {
    /** Empty private constructor prevents end users from constructing a new instance of the API */
    constructor() {
    }
    /** Get the singleton instance of the Metrics API */
    static getInstance() {
      if (!this._instance) {
        this._instance = new _MetricsAPI();
      }
      return this._instance;
    }
    /**
     * Set the current global meter provider.
     * Returns true if the meter provider was successfully registered, else false.
     */
    setGlobalMeterProvider(provider) {
      return registerGlobal(API_NAME3, provider, DiagAPI.instance());
    }
    /**
     * Returns the global meter provider.
     */
    getMeterProvider() {
      return getGlobal(API_NAME3) || NOOP_METER_PROVIDER;
    }
    /**
     * Returns a meter from the global meter provider.
     */
    getMeter(name, version, options) {
      return this.getMeterProvider().getMeter(name, version, options);
    }
    /** Remove the global meter provider */
    disable() {
      unregisterGlobal(API_NAME3, DiagAPI.instance());
    }
  };

  // src/metrics-api.ts
  var metrics = MetricsAPI.getInstance();

  // src/propagation/NoopTextMapPropagator.ts
  var NoopTextMapPropagator = class {
    /** Noop inject function does nothing */
    inject(_context, _carrier) {
    }
    /** Noop extract function does nothing and returns the input context */
    extract(context2, _carrier) {
      return context2;
    }
    fields() {
      return [];
    }
  };

  // src/baggage/context-helpers.ts
  var BAGGAGE_KEY = createContextKey("OpenTelemetry Baggage Key");
  function getBaggage(context2) {
    return context2.getValue(BAGGAGE_KEY) || void 0;
  }
  function getActiveBaggage() {
    return getBaggage(ContextAPI.getInstance().active());
  }
  function setBaggage(context2, baggage) {
    return context2.setValue(BAGGAGE_KEY, baggage);
  }
  function deleteBaggage(context2) {
    return context2.deleteValue(BAGGAGE_KEY);
  }

  // src/api/propagation.ts
  var API_NAME4 = "propagation";
  var NOOP_TEXT_MAP_PROPAGATOR = new NoopTextMapPropagator();
  var PropagationAPI = class _PropagationAPI {
    /** Empty private constructor prevents end users from constructing a new instance of the API */
    constructor() {
      this.createBaggage = createBaggage;
      this.getBaggage = getBaggage;
      this.getActiveBaggage = getActiveBaggage;
      this.setBaggage = setBaggage;
      this.deleteBaggage = deleteBaggage;
    }
    /** Get the singleton instance of the Propagator API */
    static getInstance() {
      if (!this._instance) {
        this._instance = new _PropagationAPI();
      }
      return this._instance;
    }
    /**
     * Set the current propagator.
     *
     * @returns true if the propagator was successfully registered, else false
     */
    setGlobalPropagator(propagator) {
      return registerGlobal(API_NAME4, propagator, DiagAPI.instance());
    }
    /**
     * Inject context into a carrier to be propagated inter-process
     *
     * @param context Context carrying tracing data to inject
     * @param carrier carrier to inject context into
     * @param setter Function used to set values on the carrier
     */
    inject(context2, carrier, setter = defaultTextMapSetter) {
      return this._getGlobalPropagator().inject(context2, carrier, setter);
    }
    /**
     * Extract context from a carrier
     *
     * @param context Context which the newly created context will inherit from
     * @param carrier Carrier to extract context from
     * @param getter Function used to extract keys from a carrier
     */
    extract(context2, carrier, getter = defaultTextMapGetter) {
      return this._getGlobalPropagator().extract(context2, carrier, getter);
    }
    /**
     * Return a list of all fields which may be used by the propagator.
     */
    fields() {
      return this._getGlobalPropagator().fields();
    }
    /** Remove the global propagator */
    disable() {
      unregisterGlobal(API_NAME4, DiagAPI.instance());
    }
    _getGlobalPropagator() {
      return getGlobal(API_NAME4) || NOOP_TEXT_MAP_PROPAGATOR;
    }
  };

  // src/propagation-api.ts
  var propagation = PropagationAPI.getInstance();

  // src/api/trace.ts
  var API_NAME5 = "trace";
  var TraceAPI = class _TraceAPI {
    /** Empty private constructor prevents end users from constructing a new instance of the API */
    constructor() {
      this._proxyTracerProvider = new ProxyTracerProvider();
      this.wrapSpanContext = wrapSpanContext;
      this.isSpanContextValid = isSpanContextValid;
      this.deleteSpan = deleteSpan;
      this.getSpan = getSpan;
      this.getActiveSpan = getActiveSpan;
      this.getSpanContext = getSpanContext;
      this.setSpan = setSpan;
      this.setSpanContext = setSpanContext;
    }
    /** Get the singleton instance of the Trace API */
    static getInstance() {
      if (!this._instance) {
        this._instance = new _TraceAPI();
      }
      return this._instance;
    }
    /**
     * Set the current global tracer.
     *
     * @returns true if the tracer provider was successfully registered, else false
     */
    setGlobalTracerProvider(provider) {
      const success = registerGlobal(
        API_NAME5,
        this._proxyTracerProvider,
        DiagAPI.instance()
      );
      if (success) {
        this._proxyTracerProvider.setDelegate(provider);
      }
      return success;
    }
    /**
     * Returns the global tracer provider.
     */
    getTracerProvider() {
      return getGlobal(API_NAME5) || this._proxyTracerProvider;
    }
    /**
     * Returns a tracer from the global tracer provider.
     */
    getTracer(name, version) {
      return this.getTracerProvider().getTracer(name, version);
    }
    /** Remove the global tracer provider */
    disable() {
      unregisterGlobal(API_NAME5, DiagAPI.instance());
      this._proxyTracerProvider = new ProxyTracerProvider();
    }
  };

  // src/trace-api.ts
  var trace = TraceAPI.getInstance();

  // src/index.ts
  var src_default = {
    context,
    diag: diag2,
    metrics,
    propagation,
    trace
  };

  // PATCH
  return src_default
})();
