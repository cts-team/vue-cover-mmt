export default {
  name: "CoverChild",
  functional: true,
  props: {
    coverChildKey: {
      type: String,
      default: ""
    },
    keepAlive: Boolean,
    keepAliveProps: {
      type: Object,
      default: undefined
    }
  },
  render(_, { parent, data, props }) {
    const h = parent.$createElement;
    data.coverChild = true;
    const _parent = parent;
    const transitions = parent.$cover.cover.transitions;
    const defaultTransition = parent.$cover.cover.defaultTransition;

    let depth = 0;
    while (parent) {
      if (parent.$vnode && parent.$vnode.data.coverChild) {
        depth++;
      }
      parent = parent.$parent;
    }
    data.coverChildDepth = depth;
    const transition = transitions[depth] || defaultTransition;
    const transitionProps = {};
    transitionsKeys.forEach(key => {
      if (typeof transition[key] !== "undefined") {
        transitionProps[key] = transition[key];
      }
    });

    const listeners = {};
    listenersKeys.forEach(key => {
      if (typeof transition[key] === "function") {
        listeners[key] = transition[key].bind(_parent);
      }
    });
    process.client = true;

    if (process.client) {
      // Add triggerScroll event on beforeEnter (fix #1376)
      const beforeEnter = listeners.beforeEnter;
      listeners.beforeEnter = el => {
        // Ensure to trigger scroll event after calling scrollBehavior
        window.$cover.$nextTick(() => {
          window.$cover.$emit("triggerScroll");
        });
        if (beforeEnter) {
          return beforeEnter.call(_parent, el);
        }
      };
    }

    // make sure that leave is called asynchronous (fix #5703)
    if (transition.css === false) {
      const leave = listeners.leave;

      // only add leave listener when user didnt provide one
      // or when it misses the done argument
      if (!leave || leave.length < 2) {
        listeners.leave = (el, done) => {
          if (leave) {
            leave.call(_parent, el);
          }

          _parent.$nextTick(done);
        };
      }
    }

    let routerView = h("routerView", data);

    if (props.keepAlive) {
      routerView = h("keep-alive", { props: props.keepAliveProps }, [
        routerView
      ]);
    }

    return h(
      "transition",
      {
        props: transitionProps,
        on: listeners
      },
      [routerView]
    );
  }
};

const transitionsKeys = [
  "name",
  "mode",
  "appear",
  "css",
  "type",
  "duration",
  "enterClass",
  "leaveClass",
  "appearClass",
  "enterActiveClass",
  "enterActiveClass",
  "leaveActiveClass",
  "appearActiveClass",
  "enterToClass",
  "leaveToClass",
  "appearToClass"
];

const listenersKeys = [
  "beforeEnter",
  "enter",
  "afterEnter",
  "enterCancelled",
  "beforeLeave",
  "leave",
  "afterLeave",
  "leaveCancelled",
  "beforeAppear",
  "appear",
  "afterAppear",
  "appearCancelled"
];
