// WIP Add WeakRef to prevent memory leaks.

type Action = () => void;

let queuedActionSet = new Set<Action>();

const resolveQueuedActions = () => {
  const readyActionSet = queuedActionSet;
  queuedActionSet = new Set();

  for (const action of readyActionSet) {
    action();
  }
};

export const queueAction: (action: Action) => void = (action) => {
  if (queuedActionSet.size < 1) {
    requestAnimationFrame(resolveQueuedActions);
  }

  queuedActionSet.add(action);
};

type Subscribable = {
  hasSubscribers: () => boolean;
  publish: () => void;
  subscribe: (action: Action) => { unsubscribe: () => void };
};

const createSubscribable = (): Subscribable => {
  const actionSet = new Set<Action>();

  return {
    hasSubscribers: () => {
      return actionSet.size > 0;
    },

    publish: () => {
      if (actionSet.size < 1) return;

      for (const action of actionSet) {
        queueAction(action);
      }
    },

    subscribe: (action) => {
      actionSet.add(action);

      return {
        unsubscribe: () => {
          actionSet.delete(action);
        },
      };
    },
  };
};

type Subscription = { unsubscribe: () => void };
type Context = {
  rerunSubscribable: Subscribable;
  subscribeForRerun: (subscribable: Subscribable) => void;
};

const contextStack: Context[] = [];

const getCurrentContext = () => contextStack[contextStack.length - 1];

export const watch = (action: Action) => {
  let subscriptionSet = new Set<Subscription>();

  const context = {
    subscribeForRerun: (subscribable: Subscribable) => {
      const subscription = subscribable.subscribe(runAction);
      subscriptionSet.add(subscription);
    },
    rerunSubscribable: createSubscribable(),
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

  let parentRerunSubscription: Subscription | null = null;
  const stop = () => {
    if (parentRerunSubscription != null) {
      parentRerunSubscription.unsubscribe();
    }

    unsubscribe();
  };

  const parentContext = getCurrentContext();
  if (parentContext != null) {
    parentRerunSubscription = parentContext.rerunSubscribable.subscribe(stop);
  }

  return { start, stop };
};

type Observable<T> = {
  get: () => T;
};

const subscribeContext = (subscribable: Subscribable) => {
  const context = getCurrentContext();
  if (context != null) {
    context.subscribeForRerun(subscribable);
  }
};

export type WritableObservable<T> = {
  get: () => T;
  set: (value: T) => void;
};

export const state = <T>(initialValue: T): WritableObservable<T> => {
  let value = initialValue;
  const subscribable = createSubscribable();

  return {
    get: () => {
      subscribeContext(subscribable);
      return value;
    },
    set: (newValue) => {
      if (newValue === value) return;

      value = newValue;

      subscribable.publish();
    },
  };
};

export const computed = <T>(compute: () => T): Observable<T> => {
  let value: T | undefined;
  let oldValue: T | undefined;
  const subscribable = createSubscribable();
  const { subscribe } = subscribable;
  subscribable.subscribe = (action) => {
    watcher.start();

    const subscription = subscribe(action);

    return {
      unsubscribe: () => {
        subscription.unsubscribe();

        if (!subscribable.hasSubscribers()) {
          watcher.stop();
        }
      },
    };
  };

  const watcher = watch(() => {
    value = compute();

    if (value !== oldValue) {
      oldValue = value;
      subscribable.publish();
    }
  });

  return {
    get: () => {
      subscribeContext(subscribable);

      if (!subscribable.hasSubscribers()) {
        value = compute();
      }

      // TODO Check for possible cases of undefined passing through.
      return value!;
    },
  };
};

type Resolvable<T> = Observable<T> | T;

export const resolveValue = <T>(value: Resolvable<T>): T => {
  return typeof value === "object" && value != null && "get" in value
    ? value.get()
    : value;
};

// WIP Create a type that resolves other types.
export const deepResolveValue = <T>(value: any): T => {
  const result = resolveValue(value);

  if (Object(result) !== result) return result;

  if (Array.isArray(result)) {
    return result.map(deepResolveValue) as any;
  }

  return Object.entries(result).reduce((result, [key, value]) => {
    result[key] = deepResolveValue(value);

    return result;
  }, {} as any);
};

type BindingMap<T, TBinding extends object> = {
  [key in keyof TBinding]: (
    target: T,
    source: TBinding[key] extends WritableObservable<any>
      ? TBinding[key]
      : Resolvable<TBinding[key]>
  ) => void;
};

type BindingSource<TBinding> = Resolvable<
  TBinding extends object
    ? {
        [key in keyof TBinding]?: BindingSource<TBinding[key]>;
      }
    : TBinding
>;

export const createBinder = <T, TBinding extends object>(
  bindingMap: BindingMap<T, TBinding>
) => {
  return {
    bind: (target: T, source: BindingSource<TBinding>) => {
      const binding = watch(() => {
        const value = resolveValue(source);

        if (value == null) return;

        Object.entries(value).forEach(([key, value]) => {
          if (!(key in bindingMap)) return;

          const bindingFunction = (bindingMap as any)[key];

          if (bindingFunction == null) return;

          bindingFunction(target, value);
        });
      });

      binding.start();

      return binding;
    },
  };
};
