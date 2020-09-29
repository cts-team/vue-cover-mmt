import Vue from "vue";

/**
 * 生产环境取消Vue的所有日志与警告
 * @type {boolean}
 */
Vue.config.silent = process.env.NODE_ENV === "production";

/**
 * 取消vue-devtools检查代码
 * @type {boolean}
 */
Vue.config.devtools = false;

/**
 * 取消Vue启动时生成生产提示
 * @type {boolean}
 */
Vue.config.productionTip = false;

import CoverError from "./components/cover-error.vue";

import {
  applyAsyncData,
  compile,
  flatMapComponents,
  getLocation,
  getMatchedComponents,
  getMatchedComponentsInstances,
  getQueryDiff,
  globalHandleError,
  isSamePath,
  middlewareSeries,
  promisify,
  resolveRouteComponents,
  sanitizeComponent,
  setContext
} from "./utils";

import { createApp } from "./index";

/**
 * 全局共享引用
 * @type {*[]}
 * @private
 */
let _lastPaths = [];
let app;
let router;
let middlewares = {};

const COVER = window.__COVER__ || {};

if (!Vue.config.$cover) {
  const defaultErrorHandler = Vue.config.errorHandler;
  Vue.config.errorHandler = async (err, vm, info, ...rest) => {
    //调用其他的处理器
    let handled = null;
    if (typeof defaultErrorHandler === "function") {
      handled = defaultErrorHandler(err, vm, info, ...rest);
    }
    if (handled === true) {
      return handled;
    }

    if (vm && vm.$root) {
      const coverApp = Object.keys(Vue.config.$cover).find(
        coverInstance => vm.$root[coverInstance]
      );

      // Show Cover Error Page
      if (coverApp && vm.$root[coverApp].error && info !== "render function") {
        const currentApp = vm.$root[coverApp];

        // Load error layout
        let layout = (CoverError.options || CoverError).layout;
        if (typeof layout === "function") {
          layout = layout(currentApp.context);
        }
        if (layout) {
          await currentApp.loadLayout(layout).catch(() => {});
        }
        currentApp.setLayout(layout);

        currentApp.error(err);
      }
    }

    if (typeof defaultErrorHandler === "function") {
      return handled;
    }

    if (err.message !== "[ElementForm]unpected width ") {
      if (process.env.NODE_ENV !== "production") {
        console.error(err);
      } else {
        console.error(err.message || err);
      }
    }
  };

  Vue.config.$cover = {};
}

Vue.config.$cover.$cover = true;

const errorHandler = Vue.config.errorHandler || console.error;

let ErrorPage = CoverError;

export const runCover = (config = {}) => {
  if (typeof COVER.config !== "object" || COVER.config === null) {
    COVER.config = {};
  }
  if (typeof config !== "object" || config === null) {
    config = {};
  }

  Object.assign(COVER.config, config);

  // Create and mount App
  createApp(COVER.config)
    .then((__app)=>{
      if (__app.app.cover.errorLayout) {
        ErrorPage = __app.app.cover.errorLayout
      }
      mountApp(__app)
    })
    .catch(errorHandler);
};

async function mountApp(__app) {
  // Set global variables
  app = __app.app;
  router = __app.router;
  middlewares = __app.middleware;

  /**
   * 创建Vue实例
   * @private
   */
  const _app = new Vue(app);

  /**
   * 挂在Vue app 到DOM
   */
  const mount = () => {
    _app.$mount("#__cover");

    // Add afterEach router hooks
    router.afterEach(normalizeComponents);

    router.afterEach(setLayoutForNextPage.bind(_app));

    router.afterEach(fixPrepatch.bind(_app));

    /**
     * 监听Vue第一次更新
     */
    Vue.nextTick(() => {
      // 调用 window.{{globals.readyCallback}} 回调
      coverReady(_app);
    });
  };

  // Resolve route components
  const Components = await Promise.all(resolveComponents(router));

  /**
   * 启用transitions
   */
  _app.setTransitions = _app.$options.cover.setTransitions.bind(_app);
  if (Components.length) {
    _app.setTransitions(mapTransitions(Components, router.currentRoute));
    _lastPaths = router.currentRoute.matched.map(route =>
      compile(route.path)(router.currentRoute.params)
    );
  }

  // Initialize error handler
  _app.$ProgressLoading = {}; // To avoid error while _app.$cover does not exist
  if (COVER.error) {
    _app.error(COVER.error);
  }

  // Add beforeEach router hooks
  router.beforeEach(loadAsyncComponents.bind(_app));
  router.beforeEach(render.bind(_app));

  // Fix in static: remove trailing slash to force hydration
  // Full static, if server-rendered: hydrate, to allow custom redirect to generated page

  // Fix in static: remove trailing slash to force hydration
  if (
    COVER.serverRendered &&
    isSamePath(COVER.routePath, _app.context.route.path)
  ) {
    return mount();
  }

  // First render on client-side
  const clientFirstMount = () => {
    normalizeComponents(router.currentRoute, router.currentRoute);
    setLayoutForNextPage.call(_app, router.currentRoute);
    checkForErrors(_app);
    // Don't call fixPrepatch.call(_app, router.currentRoute, router.currentRoute) since it's first render
    mount();
  };

  // fix: force next tick to avoid having same timestamp when an error happen on spa fallback
  await new Promise(resolve => setTimeout(resolve, 0));
  render.call(_app, router.currentRoute, router.currentRoute, path => {
    // If not redirected
    if (!path) {
      clientFirstMount();
      return;
    }

    // Add a one-time afterEach hook to
    // mount the app wait for redirect and route gets resolved
    // eslint-disable-next-line no-unused-vars
    const unregisterHook = router.afterEach((to, from) => {
      unregisterHook();
      clientFirstMount();
    });

    // Push the path and let route to be resolved
    router.push(path, undefined, err => {
      if (err) {
        errorHandler(err);
      }
    });
  });
}

/**
 * 修复由于vue-router的代码分裂造成的组件格式匹配
 * @param to
 */
function normalizeComponents(to) {
  flatMapComponents(to, (Component, _, match, key) => {
    if (typeof Component === "object" && !Component.options) {
      // Updated via vue-router resolveAsyncComponents()
      Component = Vue.extend(Component);
      Component._Ctor = Component;
      match.components[key] = Component;
    }
    return Component;
  });
}

/**
 * 设置layout
 * @param to
 */
function setLayoutForNextPage(to) {
  // Set layout
  let hasError = Boolean(this.$options.cover.err);
  if (this._hadError && this._dateLastError === this.$options.cover.dateErr) {
    hasError = false;
  }

  let layout = hasError
    ? (ErrorPage.options || ErrorPage).layout
    : to.matched[0].components.default.options.layout;

  if (typeof layout === "function") {
    layout = layout(app.context);
  }
  this.setLayout(layout);
}

/**
 * 当导航到一个不同的路由但使用了相同的组件时Vue.js不会更新实例数据，因此我们必须自己更新$data
 * @param to
 */
function fixPrepatch(to) {
  if (
    this._routeChanged === false &&
    this._paramChanged === false &&
    this._queryChanged === false
  ) {
    return;
  }

  const instances = getMatchedComponentsInstances(to);
  const Components = getMatchedComponents(to);

  Vue.nextTick(() => {
    instances.forEach((instance, i) => {
      if (!instance || instance._isDestroyed) {
        return;
      }

      if (
        instance.constructor._dataRefresh &&
        Components[i] === instance.constructor &&
        instance.$vnode.data.keepAlive !== true &&
        typeof instance.constructor.options.data === "function"
      ) {
        const newData = instance.constructor.options.data.call(instance);
        for (const key in newData) {
          Vue.set(instance.$data, key, newData[key]);
        }

        // Ensure to trigger scroll event after calling scrollBehavior
        window.$cover.$nextTick(() => {
          window.$cover.$emit("triggerScroll");
        });
      }
    });
    checkForErrors(this);
  });
}

function coverReady(_app) {
  if (Array.isArray(window.onCoverReadyCbs)) {
    window.onCoverReadyCbs.forEach(cb => {
      if (typeof cb === "function") {
        cb(_app);
      }
    });
  }

  // Special JSDOM
  if (typeof window._onCoverLoaded === "function") {
    window._onCoverLoaded(_app);
  }
  // Add router hooks
  router.afterEach((to, from) => {
    // Wait for fixPrepatch + $data updates
    Vue.nextTick(() => _app.$cover.$emit("routeChanged", to, from));
  });
}

/**
 * 获取被匹配的组件
 *
 * @param router
 * @returns {*}
 */
function resolveComponents(router) {
  const path = getLocation(router.options.base, router.options.mode);

  return flatMapComponents(
    router.match(path),
    async (Component, _, match, key) => {
      // 如果组件还未解析，先进行解析
      if (typeof Component === "function" && !Component.options) {
        Component = await Component();
      }

      // Sanitize it and save it
      const _Component = applySSRData(sanitizeComponent(Component));
      match.components[key] = _Component;
      return _Component;
    }
  );
}

function callMiddleware(Components, context, layout) {
  let midd = Object.keys(middlewares);
  let unknownMiddleware = false;

  // If layout is undefined, only call global middleware
  if (typeof layout !== "undefined") {
    midd = []; // Exclude global middleware if layout defined (already called before)
    layout = sanitizeComponent(layout);
    if (layout.options.middleware) {
      midd = midd.concat(layout.options.middleware);
    }
    Components.forEach(Component => {
      if (Component.options.middleware) {
        midd = midd.concat(Component.options.middleware);
      }
    });
  }

  midd = midd.map(name => {
    if (typeof name === "function") {
      return name;
    }
    if (typeof middlewares[name] !== "function") {
      unknownMiddleware = true;
      this.error({ statusCode: 500, message: "Unknown middleware " + name });
    }
    return middlewares[name];
  });

  if (unknownMiddleware) {
    return;
  }
  return middlewareSeries(midd, context);
}

async function render(to, from, next) {
  if (
    this._routeChanged === false &&
    this._paramChanged === false &&
    this._queryChanged === false
  ) {
    return next();
  }
  // Handle first render on SPA mode
  // eslint-disable-next-line no-unused-vars
  let spaFallback = false;
  if (to === from) {
    _lastPaths = [];
    spaFallback = true;
  } else {
    const fromMatches = [];
    _lastPaths = getMatchedComponents(from, fromMatches).map((Component, i) => {
      return compile(from.matched[fromMatches[i]].path)(from.params);
    });
  }

  // nextCalled is true when redirected
  let nextCalled = false;
  const _next = path => {
    if (from.path === path.path && this.$ProgressLoading.finish) {
      this.$ProgressLoading.finish();
    }

    if (from.path !== path.path && this.$ProgressLoading.pause) {
      this.$ProgressLoading.pause();
    }

    if (nextCalled) {
      return;
    }

    nextCalled = true;
    next(path);
  };

  // Update context
  await setContext(app, {
    route: to,
    from,
    next: _next.bind(this)
  });
  this._dateLastError = app.cover.dateErr;
  this._hadError = Boolean(app.cover.err);

  // Get route's matched components
  const matches = [];
  const Components = getMatchedComponents(to, matches);

  // If no Components matched, generate 404
  if (!Components.length) {
    // Default layout
    await callMiddleware.call(this, Components, app.context);

    if (nextCalled) {
      return;
    }

    // Load layout for error page
    const errorLayout = (ErrorPage.options || ErrorPage).layout;
    const layout = await this.loadLayout(
      typeof errorLayout === "function"
        ? errorLayout.call(ErrorPage, app.context)
        : errorLayout
    );

    await callMiddleware.call(this, Components, app.context, layout);

    if (nextCalled) {
      return;
    }

    // Show error page
    app.context.error({
      statusCode: 404,
      message: "This page could not be found"
    });

    return next();
  }

  // Update ._data and other properties if hot reloaded
  Components.forEach(Component => {
    if (Component._Ctor && Component._Ctor.options) {
      Component.options.asyncData = Component._Ctor.options.asyncData;
      Component.options.fetch = Component._Ctor.options.fetch;
    }
  });

  // Apply transitions
  this.setTransitions(mapTransitions(Components, to, from));

  try {
    // Call middleware
    await callMiddleware.call(this, Components, app.context);
    if (nextCalled) {
      return;
    }
    if (app.context._errored) {
      return next();
    }

    // Set layout
    let layout = Components[0].options.layout;
    if (typeof layout === "function") {
      layout = layout(app.context);
    }
    layout = await this.loadLayout(layout);

    // Call middleware for layout
    await callMiddleware.call(this, Components, app.context, layout);
    if (nextCalled) {
      return;
    }
    if (app.context._errored) {
      return next();
    }

    // Call .validate()
    let isValid = true;
    try {
      for (const Component of Components) {
        if (typeof Component.options.validate !== "function") {
          continue;
        }

        isValid = await Component.options.validate(app.context);

        if (!isValid) {
          break;
        }
      }
    } catch (validationError) {
      // ...If .validate() threw an error
      this.error({
        statusCode: validationError.statusCode || "500",
        message: validationError.message
      });
      return next();
    }

    // ...If .validate() returned false
    if (!isValid) {
      this.error({ statusCode: 404, message: "This page could not be found" });
      return next();
    }

    let instances;
    // Call asyncData & fetch hooks on components matched by the route.
    await Promise.all(
      Components.map(async (Component, i) => {
        // Check if only children route changed
        Component._path = compile(to.matched[matches[i]].path)(to.params);
        Component._dataRefresh = false;
        const childPathChanged = Component._path !== _lastPaths[i];
        // Refresh component (call asyncData & fetch) when:
        // Route path changed part includes current component
        // Or route param changed part includes current component and watchParam is not `false`
        // Or route query is changed and watchQuery returns `true`
        if (this._routeChanged && childPathChanged) {
          Component._dataRefresh = true;
        } else if (this._paramChanged && childPathChanged) {
          const watchParam = Component.options.watchParam;
          Component._dataRefresh = watchParam !== false;
        } else if (this._queryChanged) {
          const watchQuery = Component.options.watchQuery;
          if (watchQuery === true) {
            Component._dataRefresh = true;
          } else if (Array.isArray(watchQuery)) {
            Component._dataRefresh = watchQuery.some(
              key => this._diffQuery[key]
            );
          } else if (typeof watchQuery === "function") {
            if (!instances) {
              instances = getMatchedComponentsInstances(to);
            }
            Component._dataRefresh = watchQuery.apply(instances[i], [
              to.query,
              from.query
            ]);
          }
        }
        if (!this._hadError && this._isMounted && !Component._dataRefresh) {
          return;
        }

        const promises = [];

        const hasAsyncData =
          Component.options.asyncData &&
          typeof Component.options.asyncData === "function";

        const hasFetch =
          Boolean(Component.options.fetch) && Component.options.fetch.length;

        const loadingIncrease = hasAsyncData && hasFetch ? 30 : 45;

        // Call asyncData(context)
        if (hasAsyncData) {
          const promise = promisify(Component.options.asyncData, app.context);

          promise.then(asyncDataResult => {
            applyAsyncData(Component, asyncDataResult);

            if (this.$ProgressLoading.increase) {
              this.$ProgressLoading.increase(loadingIncrease);
            }
          });
          promises.push(promise);
        }

        // Check disabled page loading
        this.$ProgressLoading.manual = Component.options.loading === false;

        // Call fetch(context)
        if (hasFetch) {
          let p = Component.options.fetch(app.context);
          if (!p || (!(p instanceof Promise) && typeof p.then !== "function")) {
            p = Promise.resolve(p);
          }
          // eslint-disable-next-line no-unused-vars
          p.then(fetchResult => {
            if (this.$ProgressLoading.increase) {
              this.$ProgressLoading.increase(loadingIncrease);
            }
          });
          promises.push(p);
        }

        return Promise.all(promises);
      })
    );

    // If not redirected
    if (!nextCalled) {
      if (this.$ProgressLoading.finish && !this.$ProgressLoading.manual) {
        this.$ProgressLoading.finish();
      }

      next();
    }
  } catch (err) {
    const error = err || {};
    if (error.message === "ERR_REDIRECT") {
      return this.$cover.$emit("routeChanged", to, from, error);
    }
    _lastPaths = [];

    globalHandleError(error);

    // Load error layout
    let layout = (ErrorPage.options || ErrorPage).layout;
    if (typeof layout === "function") {
      layout = layout(app.context);
    }
    await this.loadLayout(layout);

    this.error(error);
    this.$cover.$emit("routeChanged", to, from, error);
    next();
  }
}

function mapTransitions(toComponents, to, from) {
  const componentTransitions = component => {
    const transition = componentOption(component, "transition", to, from) || {};
    return typeof transition === "string" ? { name: transition } : transition;
  };

  const fromComponents = from ? getMatchedComponents(from) : [];
  const maxDepth = Math.max(toComponents.length, fromComponents.length);

  const mergedTransitions = [];
  for (let i = 0; i < maxDepth; i++) {
    // Clone original objects to prevent overrides
    const toTransitions = Object.assign(
      {},
      componentTransitions(toComponents[i])
    );
    const transitions = Object.assign(
      {},
      componentTransitions(fromComponents[i])
    );

    // Combine transitions & prefer `leave` properties of "from" route
    Object.keys(toTransitions)
      .filter(
        key =>
          typeof toTransitions[key] !== "undefined" &&
          !key.toLowerCase().includes("leave")
      )
      .forEach(key => {
        transitions[key] = toTransitions[key];
      });

    mergedTransitions.push(transitions);
  }
  return mergedTransitions;
}

/**
 * 加载异步组件
 * @param to
 * @param from
 * @param next
 * @returns {Promise<void>}
 */
async function loadAsyncComponents(to, from, next) {
  // Check if route changed (this._routeChanged), only if the page is not an error (for validate())
  this._routeChanged = Boolean(app.cover.err) || from.name !== to.name;
  this._paramChanged = !this._routeChanged && from.path !== to.path;
  this._queryChanged = !this._paramChanged && from.fullPath !== to.fullPath;
  this._diffQuery = this._queryChanged
    ? getQueryDiff(to.query, from.query)
    : [];

  if (
    (this._routeChanged || this._paramChanged) &&
    this.$ProgressLoading.start &&
    !this.$ProgressLoading.manual
  ) {
    this.$ProgressLoading.start();
  }

  try {
    if (this._queryChanged) {
      const Components = await resolveRouteComponents(
        to,
        (Component, instance) => ({ Component, instance })
      );
      // Add a marker on each component that it needs to refresh or not
      const startLoader = Components.some(({ Component, instance }) => {
        const watchQuery = Component.options.watchQuery;
        if (watchQuery === true) {
          return true;
        }
        if (Array.isArray(watchQuery)) {
          return watchQuery.some(key => this._diffQuery[key]);
        }
        if (typeof watchQuery === "function") {
          return watchQuery.apply(instance, [to.query, from.query]);
        }
        return false;
      });

      if (startLoader && this.$ProgressLoading.start && !this.$ProgressLoading.manual) {
        this.$ProgressLoading.start();
      }
    }
    // Call next()
    next();
  } catch (error) {
    const err = error || {};
    const statusCode =
      err.statusCode ||
      err.status ||
      (err.response && err.response.status) ||
      500;
    const message = err.message || "";

    // Handle chunk loading errors
    // This may be due to a new deployment or a network problem
    if (/^Loading( CSS)? chunk (\d)+ failed\./.test(message)) {
      window.location.reload(true /* skip cache */);
      return; // prevent error page blinking for user
    }

    this.error({ statusCode, message });
    this.$cover.$emit("routeChanged", to, from, err);
    next();
  }
}

function componentOption(component, key, ...args) {
  if (!component || !component.options || !component.options[key]) {
    return {};
  }
  const option = component.options[key];
  if (typeof option === "function") {
    return option(...args);
  }
  return option;
}

function applySSRData(Component) {
  // if (Cover.serverRendered && ssrData) {
  //     applyAsyncData(Component, ssrData);
  // }
  //
  Component._Ctor = Component;
  return Component;
}

function checkForErrors(app) {
  // Hide error component if no error
  if (app._hadError && app._dateLastError === app.$options.cover.dateErr) {
    app.error();
  }
}
