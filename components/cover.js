import Vue from "vue";
import { compile } from "../utils";

import CoverError from "./cover-error.vue";

import CoverChild from "./cover-child";

export default {
  name: "Cover",
  components: {
    CoverChild,
    CoverError
  },
  props: {
    coverChildKey: {
      type: String,
      default: undefined
    },
    keepAlive: Boolean,
    keepAliveProps: {
      type: Object,
      default: undefined
    },
    name: {
      type: String,
      default: "default"
    }
  },
  errorCaptured(error) {
    // if we receive and error while showing the CoverError component
    // capture the error and force an immediate update so we re-render
    // without the CoverError component
    if (this.displayingCoverError) {
      this.errorFromCoverError = error;
      this.$forceUpdate();
    }
  },
  computed: {
    routerViewKey() {
      // If coverChildKey prop is given or current route has children
      if (
        typeof this.coverChildKey !== "undefined" ||
        this.$route.matched.length > 1
      ) {
        return (
          this.coverChildKey ||
          compile(this.$route.matched[0].path)(this.$route.params)
        );
      }

      const [matchedRoute] = this.$route.matched;

      if (!matchedRoute) {
        return this.$route.path;
      }

      const Component = matchedRoute.components.default;

      if (Component && Component.options) {
        const { options } = Component;

        if (options.key) {
          return typeof options.key === "function"
            ? options.key(this.$route)
            : options.key;
        }
      }

      const strict = /\/$/.test(matchedRoute.path);
      return strict ? this.$route.path : this.$route.path.replace(/\/$/, "");
    }
  },
  beforeCreate() {
    Vue.util.defineReactive(this, "cover", this.$root.$options.cover);
  },
  render(h) {
    // if there is no error
    if (!this.cover.err) {
      // Directly return cover child
      return h("CoverChild", {
        key: this.routerViewKey,
        props: this.$props
      });
    }

    // if an error occurred within CoverError show a simple
    // error message instead to prevent looping
    if (this.errorFromCoverError) {
      this.$nextTick(() => (this.errorFromCoverError = false));

      return h("div", {}, [
        h("h2", "An error occurred while showing the error page"),
        h(
          "p",
          "Unfortunately an error occurred and while showing the error page another error occurred"
        ),
        h("p", `Error details: ${this.errorFromCoverError.toString()}`),
        h("cover-link", { props: { to: "/" } }, "Go back to home")
      ]);
    }

    // track if we are showing the CoverError component
    this.displayingCoverError = true;
    this.$nextTick(() => (this.displayingCoverError = false));

    let ErrorPage = this.cover.errorLayout || CoverError

    return h(ErrorPage, {
      props: {
        error: this.cover.err
      }
    });
  }
};
