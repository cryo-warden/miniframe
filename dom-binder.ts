import {
  queueAction,
  watch,
  resolveValue,
  createBinder,
  type WritableObservable,
} from "./miniframe";

type DOMBindingMap = {
  tag: string;
  classList: string[];
  children: (string | DOMBindingMap)[];
  events: Record<string, EventListener>;
  attributes: Record<string, unknown>;
  value: WritableObservable<string>;
  textInput: WritableObservable<string>;
};

export const domBinder = createBinder<
  HTMLElement | HTMLInputElement,
  DOMBindingMap
>({
  tag: () => {},
  classList: (target, source) => {
    watch(() => {
      const classNames = resolveValue(source);

      Array.from(target.classList).forEach((className) => {
        target.classList.remove(className);
      });

      classNames.forEach((classNameSource) => {
        let oldClassName: string | null = null;
        watch(() => {
          const newClassName = resolveValue(classNameSource);
          if (oldClassName !== newClassName && oldClassName !== null) {
            target.classList.remove(oldClassName);
            if (newClassName != null) {
              target.classList.add(newClassName);
            }
            oldClassName = newClassName;
          }
        }).start();
      });
    }).start();
  },
  children: (target, source) => {
    watch(() => {
      const children = resolveValue(source);

      while (target.firstChild) {
        target.removeChild(target.firstChild);
      }

      if (children == null) return;

      const nodes = children.map((childSource) => {
        const child = resolveValue(childSource);

        if (child == null) return null;

        if (typeof child === "string") {
          return document.createTextNode(child);
        }

        const element = document.createElement(
          resolveValue(child.tag) || "div"
        );

        domBinder.bind(element, child);

        return element;
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
    let oldEvents: Record<string, EventListener> | null = null;
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

        oldEvents![key] = action;

        target.addEventListener(key, action);
      });
    }).start();
  },
  attributes: (target, source) => {
    let oldAttributes: any = null;
    watch(() => {
      const attributes: any = resolveValue(source);

      if (oldAttributes != null) {
        Object.entries(oldAttributes).forEach(([key]) => {
          if (attributes[key] != null) return;

          target.removeAttribute(key);
        });
      }

      oldAttributes = {};

      Object.entries(attributes).forEach(([key, attributeSource]) => {
        const attribute = resolveValue(attributeSource) as string;

        oldAttributes[key] = attribute;

        target.setAttribute(key, attribute);
      });
    }).start();
  },
  value: (target, source) => {
    target.addEventListener("change", (e) => {
      // TODO Allow specification of writable sources in type system.
      (source as any).set((target as HTMLInputElement).value);
    });

    watch(() => {
      const value = source.get();
      if (value != null) {
        (target as HTMLInputElement).value = value;
      }
    }).start();
  },
  textInput: (target, source) => {
    const updateSource = () => {
      source.set((target as HTMLInputElement).value);
    };

    target.addEventListener("keydown", (e) => {
      queueAction(updateSource);
    });

    watch(() => {
      const value = source.get();
      if (value != null) {
        (target as HTMLInputElement).value = value;
      }
    }).start();
  },
});
