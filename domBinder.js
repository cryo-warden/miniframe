(() => {

const {
  watch,
  resolveValue,
  createBinder,
} = mini;

const domBinder = createBinder({
  classList: (target, source) => {
    watch(() => {
      const classNames = resolveValue(source);

      [...target.classList].forEach((className) => {
        target.classList.remove(className);
      });

      classNames.forEach((classNameSource) => {
        let oldClassName = null;
        watch(() => {
          const newClassName = resolveValue(classNameSource);
          if (oldClassName !== newClassName) {
            target.classList.remove(oldClassName)
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

        if (child === Object(child)) {
          const element = document.createElement(
            resolveValue(child.tag) || "div",
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
  attributes: (target, source) => {
    let oldAttributes = null;
    watch(() => {
      const attributes = resolveValue(source);

      if (oldAttributes != null) {
        Object.entries(oldAttributes).forEach(([key]) => {
          if (attributes[key] != null) return;

          target.removeAttribute(key);
        });
      }

      oldAttributes = {};

      Object.entries(attributes).forEach(([key, attributeSource]) => {
        const attribute = resolveValue(attributeSource);

        oldAttributes[key] = attribute;

        target.setAttribute(key, attribute);
      });
    }).start();
  },
  value: (target, source) => {
    target.addEventListener("change", (e) => {
      source.set(target.value);
    });

    watch(() => {
      const value = source.get();
      if (value != null) {
        target.value = value;
      }
    }).start();
  },
});

window.domBinder = domBinder;

})();