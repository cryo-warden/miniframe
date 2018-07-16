// mini framework for pub-sub and rendering
(() => {

const queueAction = (() => {
  let queuedActionSet = new Set();

  const resolveQueuedActions = () => {
    const readyActionSet = queuedActionSet;
    queuedActionSet = new Set();

    for (const action of readyActionSet) {
      action();
    }
  };

  return (action) => {
    if (queuedActionSet.size < 1) {
      requestAnimationFrame(resolveQueuedActions);
    }

    queuedActionSet.add(action);
  };
})();

class Subscribable {
  constructor() {
    this.actionSet = new Set();
  }

  hasSubscribers() { return this.actionSet.size > 0; }

  publish() {
    if (this.actionSet.size < 1) return;

    for (const action of this.actionSet) {
      queueAction(action);
    }
  }

  subscribe(action) {
    this.actionSet.add(action);

    return {
      unsubscribe: () => { this.actionSet.delete(action); },
    };
  }
}

const {
  getCurrentContext,
  watch,
} = (() => {
  const contextStack = [];

  return {
    getCurrentContext: () => contextStack[contextStack.length - 1],
    watch: (action) => {
      let subscriptionSet = new Set();

      const context = {
        subscribeForRerun: (subscribable) => {
          const subscription = subscribable.subscribe(runAction);
          subscriptionSet.add(subscription);
        },
        rerunSubscribable: new Subscribable(),
      };

      const runAction = () => {
        context.rerunSubscribable.publish();
        unsubscribe();

        contextStack.push(context);
        action();
        contextStack.pop();
      };

      const unsubscribe = () => {
        for (const subscription of subscriptionSet) {
          subscription.unsubscribe();
        }
        subscriptionSet = new Set();
      };

      let parentRerunSubscription = null;
      const start = () => {
        const parentContext = getCurrentContext();
        if (parentContext != null) {
          parentRerunSubscription = 
            parentContext.rerunSubscribable.subscribe(stop);
        }

        runAction();
      };

      const stop = () => {
        if (parentRerunSubscription != null) {
          parentRerunSubscription.unsubscribe();
        }

        unsubscribe();
      };

      return { start, stop };
    },
  };
})();

class Observable extends Subscribable {
  subscribeContext() {
    const context = getCurrentContext();
    if (context != null) {
      context.subscribeForRerun(this);
    }
  }
}

class WriteableObservable extends Observable {
  constructor(value) {
    super();

    this.value = value;
  }

  get() {
    this.subscribeContext();

    return this.value;
  }

  set(newValue) {
    if (newValue === this.value) return;

    this.value = newValue;

    this.publish();
  }
}

class ComputedObservable extends Observable {
  constructor(compute) {
    super();

    this.watch = watch(() => {
      this.value = compute();
      this.publish();
    });
  }

  get() {
    super.subscribeContext();
 
    return this.value;
  }

  subscribe(action) {
    this.watch.start();

    const subscription = super.subscribe(action);

    return {
      unsubscribe: () => {
        subscription.unsubscribe();

        if (!this.hasSubscribers()) {
          this.watch.stop();
        }
      },
    };
  }
}

const state = (value) => new WriteableObservable(value);

const computed = (compute) => new ComputedObservable(compute);

const resolveValue = (value) => {
  return value instanceof Observable ? value.get() : value;
};

const deepResolveValue = (value) => {
  const result = resolveValue(value);

  if (Object(result) !== result) return result;

  if (Array.isArray(result)) return result.map(deepResolveValue);

  return Object.entries(result).reduce((result, [key, value]) => {
    result[key] = deepResolveValue(value);

    return result;
  }, {});
};

const bindingMap = {
  classList: (target, source) => {
    watch(() => {
      const classNames = resolveValue(source);

      [...target.classList].forEach((className) => {
        target.classList.remove(className);
      });

      classNames.forEach((className) => {
        let oldValue = null;
        watch(() => {
          const newValue = resolveValue(className);
          if (oldValue !== newValue) {
            target.classList.remove(oldValue)
            if (newValue != null) { 
              target.classList.add(newValue);
            }
            oldValue = newValue;
          }
        }).start();
      });
    }).start();
  },
  children: (target, source) => {
    watch(() => {
      const value = resolveValue(source);

      while (target.firstChild) {
        target.removeChild(target.firstChild);
      }

      if (value == null) return;

      const nodes = value.map((childSource) => {
        const child = resolveValue(childSource);

        if (child == null) return null;

        if (child === Object(child)) {
          const element = document.createElement(
            resolveValue(child.tag) || "div"
          );

          domBinder.bind(element, child);

          return element;
        } else {
          return document.createTextNode(child);
        }
      });

      const fragment = document.createDocumentFragment();

      nodes.forEach((node) => {
        if (node == null) return;

        fragment.appendChild(node);
      });

      target.appendChild(fragment);
    }).start();
  },
  events: (target, source) => {
    let oldEvents = null;
    watch(() => {
      const events = resolveValue(source);

      if (oldEvents != null) {
        Object.entries(oldEvents).forEach(([key, action]) => {
          target.removeEventListener(key, action);
        });
      }

      oldEvents = {};

      Object.entries(events).forEach(([key, actionSource]) => {
        const action = resolveValue(actionSource);

        oldEvents[key] = action;

        target.addEventListener(key, action);
      });
    }).start();
  },
};

const domBinder = {
  bind: (element, source) => {
    const binding = watch(() => {
      const value = resolveValue(source);
  
      if (value == null) return;
  
      Object.entries(value).forEach(([key, value]) => {
        const bindingFunction = bindingMap[key];
        if (bindingMap[key] == null) return;
  
        bindingFunction(element, value);
      });
    });
  
    binding.start();
  
    return binding;
  },
  defineBinding: (name, action) => {
    bindingMap[name] = action;
  },
};

// TODO refactor for generic createBinder

window.mini = {
  watch,

  state,
  computed,

  resolveValue,
  deepResolveValue,

  domBinder,
};

})();
