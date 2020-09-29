import Vue from "vue";

import { App } from "./App";

import {
  createI18n,
  createLayouts,
  createMiddleware,
  createPlugin,
  createRouter,
  createStore,
  requireAll
} from "./make";

/**
 * 注册CoverChild组件
 */
import CoverChild from "./components/cover-child";

Vue.component("CoverChild", CoverChild);
Vue.component("CChild", CoverChild);

/**
 * 注册CoverLink组件
 */
import CoverLink from "./components/cover-link";
Vue.component(CoverLink.name, CoverLink);
Vue.component("CLink", CoverLink);

/**
 * 注册Cover组件
 */
import Cover from "./components/cover";
Vue.component("Cover", Cover);

import { getLocation, normalizeError, setContext } from "./utils";

const defaultTransition = {
  name: "page",
  mode: "out-in",
  appear: true,
  appearClass: "appear",
  appearActiveClass: "appear-active",
  appearToClass: "appear-to"
};

async function createApp(config) {
  const requireContext = require.context('../../src', true, /\.js|vue|svg$/);
  requireAll(requireContext, config.cover);

  const router = await createRouter(config.router);
  const store = createStore();
  const plugins = createPlugin();
  const layouts = createLayouts();
  const middleware = createMiddleware();
  const i18n = createI18n(config.i18n);

  // 添加 this.$router 到 store 的 actions/mutations
  store.$router = router;

  const AppRest = App(layouts.layoutsMap);
  // 创建根实例
  // 这里我们注入router和store到所有子组件，确保它们可以随处作为`this.$router` 和 `this.$store` 使用
  const app = {
    store,
    router,
    cover: {
      defaultTransition,
      transitions: [defaultTransition],
      setTransitions(transitions) {
        if (!Array.isArray(transitions)) {
          transitions = [transitions];
        }
        transitions = transitions.map(transition => {
          if (!transition) {
            transition = defaultTransition;
          } else if (typeof transition === "string") {
            transition = Object.assign({}, defaultTransition, {
              name: transition
            });
          } else {
            transition = Object.assign({}, defaultTransition, transition);
          }
          return transition;
        });
        this.$options.cover.transitions = transitions;
        return transitions;
      },
      err: null,
      dateErr: null,
      errorLayout: layouts.errorLayout,
      error(err) {
        err = err || null;
        app.context._errored = Boolean(err);
        err = err ? normalizeError(err) : null;
        let cover = app.cover;
        if (this) {
          cover = this.cover || this.$options.cover;
        }
        cover.dateErr = Date.now();
        cover.err = err;
        return err;
      }
    },
    i18n,
    ...AppRest
  };

  // 确保app在store中可用，通过this.app
  store.app = app;

  const next = location => app.router.push(location);
  // Resolve route
  const path = getLocation(router.options.base, router.options.mode);
  let route = router.resolve(path).route;

  // Set context to app.context
  await setContext(app, {
    store,
    route,
    next,
    error: app.cover.error.bind(app)
  });

  function inject(key, value) {
    if (!key) {
      throw new Error("inject(key, value) has no key provided");
    }
    if (value === undefined) {
      throw new Error(`inject('${key}', value) has no value provided`);
    }

    key = "$" + key;
    // Add into app
    app[key] = value;
    // Add into context
    if (!app.context[key]) {
      app.context[key] = value;
    }

    // Add into store
    store[key] = app[key];

    // Check if plugin not already installed
    const installKey = "__COVER__" + key + "_installed__";
    if (Vue[installKey]) {
      return;
    }
    Vue[installKey] = true;
    // Call Vue.use() to install the plugin into vm
    Vue.use(() => {
      if (!Object.prototype.hasOwnProperty.call(Vue.prototype, key)) {
        Object.defineProperty(Vue.prototype, key, {
          get() {
            return this.$root.$options[key];
          }
        });
      }
    });
  }

  // Inject runtime config as $config
  inject("config", config);

  // 替换store的state再插件执行之前
  if (window.__COVER__ && window.__COVER__.state) {
    store.replaceState(window.__COVER__.state);
  }

  for (let i = 0; i < plugins.length; i++) {
    if (typeof plugins[i] === "function") {
      await plugins[i](app.context, inject);
    }
  }

  return {
    store,
    app,
    router,
    middleware
  };
}

export { createApp };
