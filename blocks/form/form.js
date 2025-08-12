import { readBlockConfig } from '../../scripts/lib-franklin.js';

function generateUnique() {
  return new Date().valueOf() + Math.random();
}

const formatFns = await (async function imports() {
  try {
    const formatters = await import('./formatting.js');
    return formatters.default;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Formatting library not found. Formatting will not be supported');
  }
  return {};
}());

function constructPayload(form) {
  const payload = { __id__: generateUnique() };
  [...form.elements].forEach((fe) => {
    if (fe.name) {
      if (fe.type === 'radio') {
        if (fe.checked) payload[fe.name] = fe.value;
      } else if (fe.type === 'checkbox') {
        if (fe.checked) payload[fe.name] = payload[fe.name] ? `${payload[fe.name]},${fe.value}` : fe.value;
      } else if (fe.type !== 'file') {
        payload[fe.name] = fe.value;
      }
    }
  });
  return { payload };
}

async function submissionFailure(error, form) {
  alert(error); // TODO define error mechansim
  form.setAttribute('data-submitting', 'false');
  form.querySelector('button[type="submit"]').disabled = false;
}

async function prepareRequest(form, transformer) {
  const { payload } = constructPayload(form);
  const headers = {
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify({ data: payload });
  const url = form.dataset.submit || form.dataset.action;
  if (typeof transformer === 'function') {
    return transformer({ headers, body, url }, form);
  }
  return { headers, body, url };
}

async function submitForm(form, transformer) {
  try {
    const { headers, body, url } = await prepareRequest(form, transformer);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    if (response.ok) {
      window.location.href = form.dataset?.redirect || 'thankyou';
    } else {
      const error = await response.text();
      throw new Error(error);
    }
  } catch (error) {
    submissionFailure(error, form);
  }
}

async function handleSubmit(form, transformer) {
  if (form.getAttribute('data-submitting') !== 'true') {
    form.setAttribute('data-submitting', 'true');
    await submitForm(form, transformer);
  }
}

function setPlaceholder(element, fd) {
  if (fd.Placeholder) {
    element.setAttribute('placeholder', fd.Placeholder);
  }
}

const constraintsDef = Object.entries({
  'email|text': [['Max', 'maxlength'], ['Min', 'minlength']],
  'number|range|date': ['Max', 'Min', 'Step'],
  file: ['Accept', 'Multiple'],
  fieldset: [['Max', 'data-max'], ['Min', 'data-min']],
}).flatMap(([types, constraintDef]) => types.split('|')
  .map((type) => [type, constraintDef.map((cd) => (Array.isArray(cd) ? cd : [cd, cd]))]));

const constraintsObject = Object.fromEntries(constraintsDef);

function setConstraints(element, fd) {
  const constraints = constraintsObject[fd.Type];
  if (constraints) {
    constraints
      .filter(([nm]) => fd[nm])
      .forEach(([nm, htmlNm]) => {
        element.setAttribute(htmlNm, fd[nm]);
      });
  }
}

function createLabel(fd, tagName = 'label') {
  const label = document.createElement(tagName);
  label.setAttribute('for', fd.Id);
  label.className = 'field-label';
  label.textContent = fd.Label || '';
  label.setAttribute('itemprop', 'Label');
  label.setAttribute('itemtype', 'text');
  if (fd.Tooltip) {
    label.title = fd.Tooltip;
  }
  return label;
}

function createHelpText(fd) {
  const div = document.createElement('div');
  div.className = 'field-description';
  div.setAttribute('aria-live', 'polite');
  div.setAttribute('itemtype', 'text');
  div.setAttribute('itemprop', 'Description');
  div.innerText = fd.Description;
  div.id = `${fd.Id}-description`;
  return div;
}

function generateItemId(id) {
  if (id) {
    return `urn:fnkconnection:${window.formPath}:default:Id:${id}`;
  }
  return `urn:fnkconnection:${window.formPath}:default`;
}

function createFieldWrapper(fd, tagName = 'div') {
  const fieldWrapper = document.createElement(tagName);
  fieldWrapper.setAttribute('itemtype', 'component');
  fieldWrapper.setAttribute('itemid', generateItemId(fd.Id));
  fieldWrapper.setAttribute('itemscope', '');
  fieldWrapper.setAttribute('data-editor-itemlabel', fd.Label || fd.Name);
  fieldWrapper.setAttribute('data-editor-itemmodel', fd.Type);
  const nameStyle = fd.Name ? ` form-${fd.Name}` : '';
  const fieldId = `form-${fd.Type}-wrapper${nameStyle}`;
  fieldWrapper.className = fieldId;
  if (fd.Fieldset) {
    fieldWrapper.dataset.fieldset = fd.Fieldset;
  }
  if (fd.Mandatory.toLowerCase() === 'true') {
    fieldWrapper.dataset.required = '';
  }
  if (fd.Hidden?.toLowerCase() === 'true') {
    fieldWrapper.dataset.hidden = 'true';
  }
  fieldWrapper.classList.add('field-wrapper');
  fieldWrapper.append(createLabel(fd));
  return fieldWrapper;
}

function createButton(fd) {
  const wrapper = createFieldWrapper(fd);
  const button = document.createElement('button');
  button.textContent = fd.Label;
  button.type = fd.Type;
  button.classList.add('button');
  button.dataset.redirect = fd.Extra || '';
  button.id = fd.Id;
  button.name = fd.Name;
  wrapper.replaceChildren(button);
  return wrapper;
}
function createSubmit(fd) {
  const wrapper = createButton(fd);
  return wrapper;
}

function createInput(fd) {
  const input = document.createElement('input');
  input.type = fd.Type;
  setPlaceholder(input, fd);
  setConstraints(input, fd);
  return input;
}

const withFieldWrapper = (element) => (fd) => {
  const wrapper = createFieldWrapper(fd);
  wrapper.append(element(fd));
  return wrapper;
};

const createTextArea = withFieldWrapper((fd) => {
  const input = document.createElement('textarea');
  setPlaceholder(input, fd);
  return input;
});

const createSelect = withFieldWrapper((fd) => {
  const select = document.createElement('select');
  if (fd.Placeholder) {
    const ph = document.createElement('option');
    ph.textContent = fd.Placeholder;
    ph.setAttribute('selected', '');
    ph.setAttribute('disabled', '');
    select.append(ph);
  }
  fd.Options.split(',').forEach((o) => {
    const option = document.createElement('option');
    option.textContent = o.trim();
    option.value = o.trim();
    select.append(option);
  });
  return select;
});

function createRadio(fd) {
  const wrapper = createFieldWrapper(fd);
  wrapper.insertAdjacentElement('afterbegin', createInput(fd));
  return wrapper;
}

const createOutput = withFieldWrapper((fd) => {
  const output = document.createElement('output');
  output.name = fd.Name;
  output.id = fd.Id;
  const displayFormat = fd['Display Format'];
  if (displayFormat) {
    output.dataset.displayFormat = displayFormat;
  }
  const formatFn = formatFns[displayFormat] || ((x) => x);
  output.innerText = formatFn(fd.Value);
  return output;
});

function createHidden(fd) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.id = fd.Id;
  input.name = fd.Name;
  input.value = fd.Value;
  return input;
}

function createLegend(fd) {
  return createLabel(fd, 'legend');
}

function createFieldSet(fd) {
  const wrapper = createFieldWrapper(fd, 'fieldset');
  wrapper.id = fd.Id;
  wrapper.name = fd.Name;
  wrapper.setAttribute('itemtype', 'container');
  wrapper.replaceChildren(createLegend(fd));
  if (fd.Repeatable && fd.Repeatable.toLowerCase() === 'true') {
    setConstraints(wrapper, fd);
    wrapper.dataset.repeatable = 'true';
  }
  return wrapper;
}

function groupFieldsByFieldSet(form) {
  const fieldsets = form.querySelectorAll('fieldset');
  fieldsets?.forEach((fieldset) => {
    const fields = form.querySelectorAll(`[data-fieldset="${fieldset.name}"`);
    fields?.forEach((field) => {
      fieldset.append(field);
    });
  });
}

function createPlainText(fd) {
  const paragraph = document.createElement('p');
  const nameStyle = fd.Name ? `form-${fd.Name}` : '';
  paragraph.className = nameStyle;
  paragraph.dataset.fieldset = fd.Fieldset ? fd.Fieldset : '';
  paragraph.textContent = fd.Label;
  return paragraph;
}

export const getId = (function getId() {
  const ids = {};
  return (name) => {
    ids[name] = ids[name] || 0;
    const idSuffix = ids[name] ? `-${ids[name]}` : '';
    ids[name] += 1;
    return `${name}${idSuffix}`;
  };
}());

const fieldRenderers = {
  radio: createRadio,
  checkbox: createRadio,
  textarea: createTextArea,
  select: createSelect,
  button: createButton,
  submit: createSubmit,
  output: createOutput,
  hidden: createHidden,
  fieldset: createFieldSet,
  plaintext: createPlainText,
};

function renderField(fd) {
  const renderer = fieldRenderers[fd.Type];
  let field;
  if (typeof renderer === 'function') {
    field = renderer(fd);
  } else {
    field = createFieldWrapper(fd);
    field.append(createInput(fd));
  }
  if (fd.Description) {
    field.append(createHelpText(fd));
  }
  return field;
}

async function applyTransformation(formDef, form) {
  try {
    const { requestTransformers, transformers } = await import('./decorators/index.js');
    if (transformers) {
      transformers.forEach(
        (fn) => fn.call(this, formDef, form),
      );
    }

    const transformRequest = async (request, fd) => requestTransformers?.reduce(
      (promise, transformer) => promise.then((modifiedRequest) => transformer(modifiedRequest, fd)),
      Promise.resolve(request),
    );
    return transformRequest;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('no custom decorators found.');
  }
  return (req) => req;
}

async function fetchData(url) {
  const resp = await fetch(url);
  const json = await resp.json();
  return json.data.map((fd) => ({
    ...fd,
    Id: fd.Id || getId(fd.Name),
    Value: fd.Value || '',
  }));
}

async function fetchForm(pathname) {
  // get the main form
  const jsonData = await fetchData(pathname);
  return jsonData;
}

async function createForm(formURL) {
  const { pathname } = new URL(formURL);
  window.formPath = pathname;
  const data = await fetchForm(pathname);
  const form = document.createElement('form');
  data.forEach((fd) => {
    const el = renderField(fd);
    const input = el.querySelector('input,textarea,select');
    if (fd.Mandatory && fd.Mandatory.toLowerCase() === 'true') {
      input.setAttribute('required', 'required');
    }
    if (input) {
      input.id = fd.Id;
      input.name = fd.Name;
      if (input.type !== 'file') {
        input.value = fd.Value;
        if (input.type === 'radio' || input.type === 'checkbox') {
          input.checked = fd.Checked === 'true';
        }
      }
      if (fd.Description) {
        input.setAttribute('aria-describedby', `${fd.Id}-description`);
      }
    }
    form.append(el);
  });
  groupFieldsByFieldSet(form);
  const transformRequest = await applyTransformation(data, form);
  // eslint-disable-next-line prefer-destructuring
  form.dataset.action = pathname?.split('.json')[0];
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    e.submitter.setAttribute('disabled', '');
    handleSubmit(form, transformRequest);
  });
  return form;
}

function loadUEScripts() {
  const head = document.getElementsByTagName('head')[0];
  const meta = document.createElement('meta');
  meta.name = 'urn:auecon:fnkconnection';
  meta.content = `fnk:${window.origin}`;
  head.appendChild(meta);
  const ueEmbedded = document.createElement('script');
  ueEmbedded.src = 'https://cdn.jsdelivr.net/gh/adobe/universal-editor-cors/dist/universal-editor-embedded.js';
  ueEmbedded.async = true;
  head.appendChild(ueEmbedded);
  const componentDefinition = document.createElement('script');
  componentDefinition.type = 'application/vnd.adobe.aem.editor.component-definition+json';
  componentDefinition.src = '/blocks/form/component-definition.json';
  head.appendChild(componentDefinition);
}

export default async function decorate(block) {
  const formLink = block.querySelector('a[href$=".json"]');
  if (formLink) {
    loadUEScripts();
    const form = await createForm(formLink.href);
    form.setAttribute('itemid', generateItemId());
    form.setAttribute('itemtype', 'container');
    form.setAttribute('itemscope', '');
    form.setAttribute('data-editor-itemlabel', 'Form Container');
    formLink.replaceWith(form);

    const config = readBlockConfig(block);
    Object.entries(config).forEach(([key, value]) => { if (value) form.dataset[key] = value; });
    
    // Add realistic form interaction errors for JS Error Agent testing
    addFormErrorSimulation(form);
  }
}

function addFormErrorSimulation(form) {
  // Simulate errors during form field interactions
  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach((input, index) => {
    // Add focus/blur error simulation
    input.addEventListener('focus', () => {
      if (Math.random() < 0.3) { // 30% chance of error on focus
        simulateFieldError(input, 'focus');
      }
    });
    
    // Add input error simulation
    input.addEventListener('input', () => {
      if (Math.random() < 0.2) { // 20% chance of error during typing
        simulateFieldError(input, 'input');
      }
    });
    
    // Add validation error simulation
    input.addEventListener('blur', () => {
      if (Math.random() < 0.25) { // 25% chance of validation error
        simulateFieldError(input, 'validation');
      }
    });
  });
  
  // Override the submit handler to add error simulation
  const originalSubmitHandler = form.onsubmit;
  form.addEventListener('submit', (e) => {
    if (Math.random() < 0.4) { // 40% chance of submit error
      e.preventDefault();
      simulateSubmitError(form);
    }
  });
}

function simulateFieldError(input, errorType) {
  const errorScenarios = {
    focus: [
      () => {
        // Simulate undefined validation function
        const validator = window.formValidator;
        validator.validateField(input.value);
      },
      () => {
        // Simulate DOM manipulation error
        const errorElement = document.getElementById('field-error');
        errorElement.innerHTML = 'Validation error';
      },
      () => {
        // Simulate API call error
        const apiResponse = undefined;
        apiResponse.data.fieldValidation(input.name);
      }
    ],
    input: [
      () => {
        // Simulate character limit validation error
        const maxLength = input.getAttribute('maxlength');
        if (maxLength && input.value.length > parseInt(maxLength)) {
          const validationResult = undefined;
          validationResult.showError();
        }
      },
      () => {
        // Simulate format validation error
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (input.type === 'email' && !emailRegex.test(input.value)) {
          const emailValidator = undefined;
          emailValidator.validate(input.value);
        }
      },
      () => {
        // Simulate real-time validation error
        const validationService = window.validationService;
        validationService.checkField(input.name, input.value);
      }
    ],
    validation: [
      () => {
        // Simulate required field validation error
        if (input.hasAttribute('required') && !input.value.trim()) {
          const requiredValidator = undefined;
          requiredValidator.showRequiredError(input);
        }
      },
      () => {
        // Simulate format validation error
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (input.type === 'tel' && input.value && !phoneRegex.test(input.value)) {
          const phoneValidator = undefined;
          phoneValidator.validatePhone(input.value);
        }
      },
      () => {
        // Simulate server-side validation error
        const serverValidator = undefined;
        serverValidator.validateFieldOnServer(input.name, input.value);
      }
    ]
  };
  
  const scenarios = errorScenarios[errorType];
  if (scenarios && Math.random() < 0.7) { // 70% chance of error within the error type
    const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    console.error(`⚠️ Form field error during ${errorType}: ${input.name || input.type}`);
    randomScenario();
  }
}

function simulateSubmitError(form) {
  const submitErrorScenarios = [
    () => {
      // Simulate network timeout during form submission
      const submitPromise = new Promise((resolve) => setTimeout(resolve, 100));
      submitPromise.then(() => {
        const response = undefined;
        response.data.submissionStatus();
      });
    },
    () => {
      // Simulate validation error during submission
      const formData = new FormData(form);
      const validator = undefined;
      validator.validateForm(formData);
    },
    () => {
      // Simulate server error during submission
      const serverResponse = undefined;
      serverResponse.processSubmission(form);
    },
    () => {
      // Simulate reCAPTCHA error
      const recaptchaResponse = document.getElementById('googleRecaptcha');
      if (recaptchaResponse) {
        const recaptchaValidator = undefined;
        recaptchaValidator.verify(recaptchaResponse.value);
      }
    },
    () => {
      // Simulate file upload error
      const fileInput = form.querySelector('input[type="file"]');
      if (fileInput && fileInput.files.length > 0) {
        const fileProcessor = undefined;
        fileProcessor.processFile(fileInput.files[0]);
      }
    },
    () => {
      // Simulate database connection error
      const dbConnection = undefined;
      dbConnection.saveUserData(form);
    }
  ];
  
  const randomSubmitError = submitErrorScenarios[Math.floor(Math.random() * submitErrorScenarios.length)];
  console.error('🚨 Form submission error occurred - user abandoned registration process');
  randomSubmitError();
}
