import Vue from "vue";

import Vuex from "vuex";
import VueI18n from "vue-i18n";
import VueRouter from "vue-router";
import scrollBehavior from "./router.scrollBehavior";

// eslint-disable-next-line no-unused-vars
import { interopDefault, sanitizeComponent } from "./utils";

Vue.use(Vuex);
Vue.use(VueI18n);
Vue.use(VueRouter);

const path = require("path");

let storeMap = {};
let layoutsMap = {};
let errorLayout = null;
let middlewareMap = {};
let pluginsMap = [require("./components/plugin")];
let localesMap = {};

const isObject = obj => {
  return typeof obj === "object" && obj !== null;
};

const coverConfig = config => {
  if (!isObject(config)) {
    config = {};
  }

  config.modulesDir = config.modulesDir || "modules";
  config.layoutsDir = config.layoutsDir || "layouts";
  config.middlewaresDir = config.middlewaresDir || "middlewares";
  config.storeDir = config.storeDir || "store";
  config.pluginsDir = config.pluginsDir || "plugins";
  config.localesDir = config.localesDir || "locales";
  config.autoLoadSvg =
    typeof config.autoLoadSvg === "boolean" ? config.autoLoadSvg : true;

  return config;
};

let handledCoverConfig = {};

export const requireAll = (requireContext, config) => {
  config = handledCoverConfig = coverConfig(config);

  const {
    modulesDir,
    layoutsDir,
    middlewaresDir,
    storeDir,
    pluginsDir,
    localesDir,
    autoLoadSvg
  } = config;

  let moduleDirRegexp = "^\\.\\/" + modulesDir + "\\/([\\w-]+)";

  requireContext.keys().forEach(filepath => {
    // match store
    const moduleStore = new RegExp(
      moduleDirRegexp + "\\/" + storeDir + "([\\/\\w-]+\\.js)$"
    ).exec(filepath);
    if (moduleStore) {
      let key = "@" + moduleStore[1] + moduleStore[2];
      storeMap[key] = requireContext(filepath);
    }

    const baseStore = new RegExp(
      "^\\.\\/" + storeDir + "([\\/\\w-]+\\.js)$"
    ).exec(filepath);
    if (baseStore) {
      storeMap[baseStore[1].slice(1)] = requireContext(filepath);
    }

    // match layouts
    const moduleLayouts = new RegExp(
      moduleDirRegexp + "\\/" + layoutsDir + "\\/([\\w-]+\\.vue)$"
    ).exec(filepath);
    if (moduleLayouts) {
      let moduleLayoutName =
          "_@" + moduleLayouts[1] + "." + path.basename(filepath, ".vue");
      layoutsMap[moduleLayoutName] = sanitizeComponent(
          requireContext(filepath).default
      );
    }
    if (
      new RegExp("^\\.\\/" + layoutsDir + "\\/([\\w-]+\\.vue)$").exec(filepath)
    ) {
      let baseLayoutName = "_" + path.basename(filepath, ".vue");
      if (baseLayoutName==='_error') {
        errorLayout = requireContext(filepath).default;
      } else {
        layoutsMap[baseLayoutName] = sanitizeComponent(
            requireContext(filepath).default
        );
      }
    }

    // match middleware
    const moduleMiddleware = new RegExp(
      moduleDirRegexp + "\\/" + middlewaresDir + "\\/([\\w-]+\\.js)$"
    ).exec(filepath);
    if (moduleMiddleware) {
      let moduleMiddlewareName =
        "@" + moduleMiddleware[1] + "." + path.basename(filepath, ".js");
      middlewareMap[moduleMiddlewareName] = requireContext(filepath);
      middlewareMap[moduleMiddlewareName] =
        middlewareMap[moduleMiddlewareName].default ||
        middlewareMap[moduleMiddlewareName];
    }
    if (
      new RegExp("^\\.\\/" + middlewaresDir + "\\/([\\w-]+\\.js)$").exec(
        filepath
      )
    ) {
      let baseMiddlewareName = path.basename(filepath, ".js");
      middlewareMap[baseMiddlewareName] = requireContext(filepath);
      middlewareMap[baseMiddlewareName] =
        middlewareMap[baseMiddlewareName].default ||
        middlewareMap[baseMiddlewareName];
    }

    // match plugin
    const modulePlugin = new RegExp(
      moduleDirRegexp + "\\/" + pluginsDir + "\\/([\\w-]+\\.js)$"
    ).exec(filepath);
    if (modulePlugin) {
      pluginsMap.push(requireContext(filepath).default);
    }
    if (
      new RegExp("^\\.\\/" + pluginsDir + "\\/([\\w-]+\\.js)$").exec(filepath)
    ) {
      pluginsMap.push(requireContext(filepath).default);
    }

    //match locales
    const moduleLocales = new RegExp(
      moduleDirRegexp + "\\/" + localesDir + "\\/([\\w-]+\\.js)$"
    ).exec(filepath);
    if (moduleLocales) {
      let moduleLocaleName =
        "@" + moduleLocales[1] + "." + path.basename(filepath, ".js");
      localesMap[moduleLocaleName] = requireContext(filepath);
      localesMap[moduleLocaleName] =
        localesMap[moduleLocaleName].default || localesMap[moduleLocaleName];
    }
    if (
      new RegExp("^\\.\\/" + localesDir + "\\/([\\w-]+\\.js)$").exec(filepath)
    ) {
      let baseLocaleName = path.basename(filepath, ".js");
      localesMap[baseLocaleName] = requireContext(filepath);
      localesMap[baseLocaleName] =
        localesMap[baseLocaleName].default || localesMap[baseLocaleName];
    }

    if (autoLoadSvg) {
      //match svg
      if (
        new RegExp(
          moduleDirRegexp + "\\/assets\\/icons\\/svg\\/([\\w-]+\\.svg)$"
        ).test(filepath)
      ) {
        requireContext(filepath);
      }
      if (/^\.\/assets\/icons\/svg\/([\w-]+\.svg)$/.exec(filepath)) {
        requireContext(filepath);
      }
    }
  });
};

export const createLayouts = () => {
  return {layoutsMap, errorLayout};
};

export const createMiddleware = () => {
  return middlewareMap;
};

export const createPlugin = () => {
  return pluginsMap;
};

export const createI18n = (options = {}) => {
  const createMessages = () => {
    let messages = {};
    Object.keys(localesMap).forEach(localeKey => {
      let items = localesMap[localeKey];
      if (typeof items !== "object" && items === null) {
        items = {};
      }

      if (Object.keys(items).length) {
        if (localeKey.startsWith("@")) {
          localeKey = localeKey.split(".");
          let moduleIdentifier = localeKey[0];
          let locale = localeKey[1];
          if (
            typeof messages[locale] !== "object" ||
            messages[locale] === null
          ) {
            messages[locale] = {};
          }
          messages[locale][moduleIdentifier] = items;
        } else {
          if (
            typeof messages[localeKey] !== "object" ||
            messages[localeKey] === null
          ) {
            messages[localeKey] = {};
          }
          messages[localeKey] = {
            ...messages[localeKey],
            ...items
          };
        }
      }
    });

    return messages;
  };
  const messages = createMessages();

  if (!isObject(options)) {
    options = {};
  }

  return new VueI18n({
    messages,
    ...options
  });
};

export const createRouter = (options = {}) => {
  if (!isObject(options)) {
    options = {};
  }
  if (!Array.isArray(options.routes)) {
    options.routes = [];
  }

  let routes = [];
  options.routes.forEach(route => {
    let newRoute = {};
    Object.keys(route).forEach(key => {
      if (key === "component") {
        if (typeof route.component === "function") {
          newRoute[key] = () => interopDefault(route.component());
        } else {
          newRoute[key] = route[key];
        }
      } else {
        newRoute[key] = route[key];
      }
    });
    routes.push(newRoute);
  });

  options.routes = routes;

  const routerOptions = {
    mode: "hash",
    base: decodeURI("/"),
    linkActiveClass: "cover-link-active",
    linkExactActiveClass: "cover-link-exact-active",
    scrollBehavior,
    ...options
  };

  let Router = new VueRouter(routerOptions);
  Router.onError(e => {
    if (process.env.NODE_ENV !== "production") {
      console.error(e);
    }
  });

  return Router;
};

export const createStore = () => {
  const VUEX_PROPERTIES = ["state", "getters", "actions", "mutations"];

  let store = { state: {}, mutations: {}, actions: {}, modules: {} };

  let modulesDir = handledCoverConfig.modulesDir;
  let storeDir = handledCoverConfig.storeDir;
  if (!modulesDir || !storeDir) return;

  function normalizeModule(moduleData, filePath) {
    if (moduleData.state && typeof moduleData.state !== "function") {
      console.warn(
        `'state' should be a method that returns an object in ${filePath}`
      );

      const state = Object.assign({}, moduleData.state);
      // Avoid TypeError: setting a property that has only a getter when overwriting top level keys
      moduleData = Object.assign({}, moduleData, { state: () => state });
    }
    return moduleData;
  }

  function resolveStoreModules(moduleData, filename) {
    moduleData = moduleData.default || moduleData;
    // Remove store src + extension (./foo/index.js -> foo/index)
    const namespace = filename.replace(/\.(js|mjs)$/, "");
    const namespaces = namespace.split("/");
    let moduleName = namespaces[namespaces.length - 1];
    const filePath = filename.startsWith("@")
      ? modulesDir + "/" + filename.slice(1)
      : `${storeDir}/${filename}`;

    moduleData =
      moduleName === "state"
        ? normalizeState(moduleData, filePath)
        : normalizeModule(moduleData, filePath);

    // If src is a known Vuex property
    if (VUEX_PROPERTIES.includes(moduleName)) {
      const property = moduleName;
      const storeModule = getStoreModule(store, namespaces, {
        isProperty: true
      });

      // Replace state since it's a function
      mergeProperty(storeModule, moduleData, property);
      return;
    }

    // If file is foo/index.js, it should be saved as foo
    const isIndexModule = moduleName === "index";
    if (isIndexModule) {
      namespaces.pop();
      moduleName = namespaces[namespaces.length - 1];
    }

    const storeModule = getStoreModule(store, namespaces);

    for (const property of VUEX_PROPERTIES) {
      mergeProperty(storeModule, moduleData[property], property);
    }

    if (moduleData.namespaced === false) {
      delete storeModule.namespaced;
    }
  }

  function normalizeState(moduleData, filePath) {
    if (typeof moduleData !== "function") {
      console.warn(`${filePath} should export a method that returns an object`);
      const state = Object.assign({}, moduleData);
      return () => state;
    }
    return normalizeModule(moduleData, filePath);
  }

  function getStoreModule(
    storeModule,
    namespaces,
    { isProperty = false } = {}
  ) {
    // If ./mutations.js
    if (!namespaces.length || (isProperty && namespaces.length === 1)) {
      return storeModule;
    }

    const namespace = namespaces.shift();

    storeModule.modules[namespace] = storeModule.modules[namespace] || {};
    storeModule.modules[namespace].namespaced = true;
    storeModule.modules[namespace].modules =
      storeModule.modules[namespace].modules || {};

    return getStoreModule(storeModule.modules[namespace], namespaces, {
      isProperty
    });
  }

  function mergeProperty(storeModule, moduleData, property) {
    if (!moduleData) {
      return;
    }

    if (property === "state") {
      storeModule.state = moduleData || storeModule.state;
    } else {
      storeModule[property] = Object.assign(
        {},
        storeModule[property],
        moduleData
      );
    }
  }

  Object.keys(storeMap).forEach(key => {
    resolveStoreModules(storeMap[key], key);
  });

  return new Vuex.Store(
    Object.assign(
      {
        strict: process.env.NODE_ENV !== "production"
      },
      store
    )
  );
};
