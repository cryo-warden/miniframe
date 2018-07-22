(() => {

const {
  mini: {
    watch,
    state,
    computed,
  },
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

  setTimeout(() => { obsA.set(1); }, 1000);
  setTimeout(() => { obsB.set(8); }, 2000);
  setTimeout(() => { obsC.set(false); }, 3000);
  setTimeout(() => { obsA.set(2); }, 4000);
  setTimeout(() => { obsB.set(9); }, 5000);
  setTimeout(() => { obsC.set(true); }, 6000);
  setTimeout(() => { obsA.set(3); }, 7000);
  setTimeout(() => { obsB.set(10); }, 8000);

  window.conditionalWatchTest = {
    obsA, obsB, obsC,
    pureC,
  };
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

//basicWatchTest();
//conditionalWatchTest();
//nestedWatchCleanupTest();

const view = state(null);

const globalState = {
  firstName: state(''),
  lastName: state(''),
  fullName: computed(() => {
    return `${globalState.firstName.get()} ${globalState.lastName.get()}`;
  }),
};

const createTextField = ({
  label,
  source,
}) => {
  return {
    classList: ["field"],
    children: [{
      tag: "label",
      children: [
        `${label} `,
        {
          tag: "input",
          attributes: { type: "text" },
          textInput: source,
        },
      ],
    }],
  };
};

const createField = ({
  label,
  type,
  source,
}) => {
  return {
    classList: ["field"],
    children: [{
      tag: "label",
      children: [
        `${label} `,
        {
          tag: "input",
          attributes: { type },
          value: source,
        },
      ],
    }],
  };
};

const root = {
  classList: state(["a", "b", "c"]),
  children: state([
    {
      tag: "h1",
      children: ["mini framework"],
    },
    "Hello, World!",
    {
      children: [
        createTextField({
          label: "First Name",
          source: globalState.firstName,
        }),
        createTextField({
          label: "Last Name",
          source: globalState.lastName,
        }),
        {
          tag: "input",
          attributes: { type: "text" },
          textInput: globalState.firstName,
        },
        {
          tag: "input",
          attributes: { type: "text" },
          textInput: globalState.lastName,
        },
        {
          tag: "p",
          children: [
            computed(() => `Full name: ${globalState.fullName.get()}`),
          ],
        },
      ],
    },
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
    children: ["This is a dynamic view. Click this to switch to another view!"],
    events: {
      click: () => {
        view.set(views.other);
      },
    },
  },
  other: {
    children: ["This is a different view. Click this to switch back!"],
    events: {
      click: () => {
        view.set(views.home);
      },
    },
  },
};

view.set(views.home);

window.root = root;
window.globalState = globalState;

})();
