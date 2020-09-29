import Vue from "vue";

import {
  getMatchedComponentsInstances,
  getChildrenComponentInstancesUsingFetch,
  promisify,
  globalHandleError
} from "./utils";

import CoverLoading from "./components/cover-loading.vue";
import CoverBuildIndicator from "./components/cover-build-indicator";

const App = layouts => {
  return {
    // eslint-disable-next-line no-unused-vars
    render(h, props) {
      const loadingEl = h("CoverLoading", { ref: "loading" });

      const layoutEl = h(this.layout || "cover");
      const templateEl = h(
        "div",
        {
          domProps: {
            id: "__layout"
          },
          key: this.layoutName
        },
        [layoutEl]
      );

      const transitionEl = h(
        "transition",
        {
          props: {
            name: "layout",
            mode: "out-in"
          },
          on: {
            // eslint-disable-next-line no-unused-vars
            beforeEnter(el) {
              // Ensure to trigger scroll event after calling scrollBehavior
              window.$cover.$nextTick(() => {
                window.$cover.$emit("triggerScroll");
              });
            }
          }
        },
        [templateEl]
      );

      return h(
        "div",
        {
          domProps: {
            id: "__cover"
          }
        },
        [loadingEl, h(CoverBuildIndicator), transitionEl]
      );
    },
    data: () => ({
      isOnline: true,

      layout: null,
      layoutName: "",

      nbFetching: 0
    }),
    beforeCreate() {
      Vue.util.defineReactive(this, "cover", this.$options.cover);
    },
    created() {
      // Add this.$cover in child instances
      Vue.prototype.$cover = this;

      // add to window so we can listen when ready
      window.$cover = this;

      this.refreshOnlineStatus();
      // Setup the listeners
      window.addEventListener("online", this.refreshOnlineStatus);
      window.addEventListener("offline", this.refreshOnlineStatus);

      // Add $cover.error()
      this.error = this.cover.error;
      // Add $cover.context
      this.context = this.$options.context;
    },
    async mounted() {
      this.$ProgressLoading = this.$refs.loading;
    },
    watch: {
      "cover.err": "errorChanged"
    },
    computed: {
      isOffline() {
        return !this.isOnline;
      },

      isFetching() {
        return this.nbFetching > 0;
      },

      isPreview() {
        return Boolean(this.$options.previewData);
      }
    },
    methods: {
      refreshOnlineStatus() {
        if (typeof window.navigator.onLine === "undefined") {
          // If the browser doesn't support connection status reports
          // assume that we are online because most apps' only react
          // when they now that the connection has been interrupted
          this.isOnline = true;
        } else {
          this.isOnline = window.navigator.onLine;
        }
      },

      async refresh() {
        const pages = getMatchedComponentsInstances(this.$route);

        if (!pages.length) {
          return;
        }
        this.$ProgressLoading.start();

        const promises = pages.map(page => {
          const p = [];

          // Old fetch
          if (page.$options.fetch && page.$options.fetch.length) {
            p.push(promisify(page.$options.fetch, this.context));
          }
          if (page.$fetch) {
            p.push(page.$fetch());
          } else {
            // Get all component instance to call $fetch
            for (const component of getChildrenComponentInstancesUsingFetch(
              page.$vnode.componentInstance
            )) {
              p.push(component.$fetch());
            }
          }

          if (page.$options.asyncData) {
            p.push(
              promisify(page.$options.asyncData, this.context).then(newData => {
                for (const key in newData) {
                  Vue.set(page.$data, key, newData[key]);
                }
              })
            );
          }

          return Promise.all(p);
        });
        try {
          await Promise.all(promises);
        } catch (error) {
          this.$ProgressLoading.fail(error);
          globalHandleError(error);
          this.error(error);
        }
        this.$ProgressLoading.finish();
      },

      errorChanged() {
        if (this.cover.err && this.$ProgressLoading) {
          if (this.$ProgressLoading.fail) {
            this.$ProgressLoading.fail(this.cover.err);
          }
          if (this.$ProgressLoading.finish) {
            this.$ProgressLoading.finish();
          }
        }
      },

      setLayout(layout) {
        if (layout && typeof layout !== "string") {
          throw new Error(
            "[cover] Avoid using non-string value as layout property."
          );
        }
        
        if (!layout || !layouts["_" + layout]) {
          layout = "default";
        }
        
        this.layoutName = layout;
        this.layout = layouts["_" + layout];
        return this.layout;
      },
      loadLayout(layout) {
        if (!layout || !layouts["_" + layout]) {
          layout = "default";
        }
        return Promise.resolve(layouts["_" + layout]);
      }
    },
    components: {
      CoverLoading
    }
  };
};

export { App };
