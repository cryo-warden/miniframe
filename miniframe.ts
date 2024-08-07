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

class Subscribable {
  private actionSet = new Set<Action>();

  hasSubscribers() {
    return this.actionSet.size > 0;
  }

  publish() {
    if (this.actionSet.size < 1) return;

    for (const action of this.actionSet) {
      queueAction(action);
    }
  }

  subscribe(action: Action) {
    this.actionSet.add(action);

    return {
      unsubscribe: () => {
        this.actionSet.delete(action);
      },
    };
  }
}

type Subscription = { unsubscribe: () => void };
type Context = {
  rerunSubscribable: Subscribable;
  subscribeForRerun: <T>(observable: Observable<T>) => void;
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

abstract class Observable<T> extends Subscribable {
  abstract get(): T;

  subscribeContext() {
    const context = getCurrentContext();
    if (context != null) {
      context.subscribeForRerun(this);
    }
  }
}

class WriteableObservable<T> extends Observable<T> {
  private value;

  constructor(value: T) {
    super();

    this.value = value;
  }

  get() {
    this.subscribeContext();

    return this.value;
  }

  set(newValue: T) {
    if (newValue === this.value) return;

    this.value = newValue;

    this.publish();
  }
}

class ComputedObservable<T> extends Observable<T> {
  private compute;
  private watch;
  private value: T | undefined;

  constructor(compute: () => T) {
    super();

    this.compute = compute;

    let oldValue: T;
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

    // TODO Check for possible cases of undefined passing through.
    return this.value!;
  }

  subscribe(action: Action) {
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

export const state = <T>(value: T) => new WriteableObservable(value);

export const computed = <T>(compute: () => T) =>
  new ComputedObservable(compute);

type Resolvable<T> = Observable<T> | T;

export const resolveValue = <T>(value: Resolvable<T>): T => {
  return value instanceof Observable ? value.get() : value;
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

export type WritableObservable<T> = {
  get: () => T;
  set: (value: T) => void;
};
