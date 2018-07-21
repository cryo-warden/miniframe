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
        if (subscriptionSet.size < 1) return;

        for (const subscription of subscriptionSet) {
          subscription.unsubscribe();
        }

        subscriptionSet = new Set();
      };

      const start = () => {
        runAction();
      };

      let parentRerunSubscription = null;
      const stop = () => {
        if (parentRerunSubscription != null) {
          parentRerunSubscription.unsubscribe();
        }

        unsubscribe();
      };

      const parentContext = getCurrentContext();
      if (parentContext != null) {
        parentRerunSubscription =
          parentContext.rerunSubscribable.subscribe(stop);
      }

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

    this.compute = compute;

    let oldValue;
    this.watch = watch(() => {
      this.value = compute();

      if (this.value !== oldValue) {
        oldValue = this.value;
        this.publish();
      }
    });
  }

  get() {
    this.subscribeContext();

    if (!this.hasSubscribers()) {
      const { compute } = this;
      this.value = compute();
    }
 
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

const createBinder = (bindingMap) => {
  return {
    bind: (target, source) => {
      const binding = watch(() => {
        const value = resolveValue(source);

        if (value == null) return;

        Object.entries(value).forEach(([key, value]) => {
          const bindingFunction = bindingMap[key];
          if (bindingMap[key] == null) return;

          bindingFunction(target, value);
        });
      });

      binding.start();

      return binding;
    },
  };
};

window.mini = {
  watch,

  state,
  computed,

  resolveValue,
  deepResolveValue,

  createBinder,
};

})();
