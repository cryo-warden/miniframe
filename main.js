(() => {

const {
  mini: {
    watch,
    state,
    computed,
    domBinder,
  }
} = window;

const basicWatchTest = () => {
  const obs = state(5);
  const pureObs = computed(() => obs.get() + 5);

  watch(() => {
    console.log("watching obs", obs.get());
  }).start();
  watch(() => {
    console.log("watching pureObs", pureObs.get());
  }).start();

  obs.set(4);
  obs.set(3);
  obs.set(3);
};

const conditionalWatchTest = () => {
  const obsA = state(0);
  const obsB = state(7);
  const obsC = state(true);
  const pureC = computed(() => obsC.get() ? obsA.get() : obsB.get());
  watch(() => {
    console.log("watching pureC", pureC.get());
  }).start();

  watch(() => {
    console.log("watching obs", obs.get());
  }).start();
};

const nestedWatchCleanupTest = () => {
  const outerState = state(0);
  const innerState = state(100);

  watch(() => {
    console.log('outer start', outerState.get());
    watch(() => {
      console.log('inner', innerState.get());
    }).start();
    console.log('outer end', outerState.get());
  }).start();

  let timeoutCount = 5;
  const updateStates = () => {
    setTimeout(() => {
      console.log("updating outer state");
      outerState.set(timeoutCount);
      setTimeout(() => {
        console.log("updating inner state");
        innerState.set(100 + timeoutCount);
      }, 100);

      timeoutCount -= 1;
      if (timeoutCount > 0) {
        updateStates();
      }
    }, 500);
  };

  updateStates();
};

//nestedWatchCleanupTest();

const view = state(null);

const root = {
  classList: state(["a", "b", "c"]),
  children: state([
    {
      tag: "h1",
      children: ["mini framework"],
    },
    "Hello, World!",
    {
      tag: "p",
      children: ["This is a paragraph element!"],
    },
    view,
  ]),
};

domBinder.bind(document.querySelector("#container"), root);

const views = {
  home: {
    children: ["This is a dynamic view."],
    events: {
      click: () => {
        view.set(views.other);
      },
    },
  },
  other: {
    children: ["This is a different view."],
    events: {
      click: () => {
        view.set(views.home);
      },
    },
  },
};

view.set(views.home);

window.root = root;

})();
