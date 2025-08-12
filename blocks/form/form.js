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
    // Use setTimeout to ensure form is fully rendered
    setTimeout(() => {
      addFormErrorSimulation(form);
      console.log('✅ Form error simulation added successfully!');
    }, 100);
  }
}

function addFormErrorSimulation(form) {
  console.log('🔧 Setting up form error simulation...');
  
  // Simulate errors during form field interactions
  const inputs = form.querySelectorAll('input, textarea, select');
  console.log(`📝 Found ${inputs.length} form inputs to add error listeners to`);
  
  inputs.forEach((input, index) => {
    console.log(`🔗 Adding error listeners to input ${index}: ${input.name || input.type}`);
    
    // Add focus error simulation - triggers every time
    input.addEventListener('focus', () => {
      console.log(`🎯 Focus event triggered on: ${input.name || input.type}`);
      simulateFieldError(input, 'focus');
    });
    
    // Add input error simulation - triggers every time
    input.addEventListener('input', () => {
      console.log(`⌨️ Input event triggered on: ${input.name || input.type}`);
      simulateFieldError(input, 'input');
    });
    
    // Add validation error simulation - triggers every time
    input.addEventListener('blur', () => {
      console.log(`👋 Blur event triggered on: ${input.name || input.type}`);
      simulateFieldError(input, 'validation');
    });
  });
  
  // Override the submit handler to add error simulation - triggers every time
  form.addEventListener('submit', (e) => {
    console.log('📤 Submit event triggered');
    e.preventDefault();
    simulateSubmitError(form);
  });
  
  console.log('✅ Form error simulation setup complete!');
}

function simulateFieldError(input, errorType) {
  const errorScenarios = {
    focus: [
      () => {
        // 1. DOM Lookup / Field Access Error
        const nonExistentField = document.getElementById('non-existent-field');
        nonExistentField.value = 'test'; // TypeError: Cannot read property 'value' of null
      },
      () => {
        // 2. Variable Reference Error
        formData = input.value; // ReferenceError: formData is not defined
      },
      () => {
        // 3. Form Name Mismatch Error
        const form = document.forms.myForm; // TypeError: Cannot read property 'myForm' of undefined
        form.submit();
      }
    ],
    input: [
      () => {
        // 4. Validation Logic Failure - input.match is not a function
        const value = input.value;
        if (value && typeof value !== 'string') {
          value.match(/^[a-zA-Z]+$/); // TypeError: value.match is not a function
        }
      },
      () => {
        // 5. RangeError: Maximum call stack size exceeded (simulated)
        let counter = 0;
        function recursiveValidation() {
          counter++;
          if (counter > 1000) {
            throw new RangeError('Maximum call stack size exceeded');
          }
          recursiveValidation();
        }
        recursiveValidation();
      },
      () => {
        // 6. Custom validator throws error
        if (input.type === 'email' && input.value) {
          throw new Error('Invalid email format');
        }
      }
    ],
    validation: [
      () => {
        // 7. Event Handler Problem - onSubmitHandler is not a function
        const submitHandler = window.onSubmitHandler;
        submitHandler(); // TypeError: onSubmitHandler is not a function
      },
      () => {
        // 8. Event object error
        const event = undefined;
        event.target.value; // TypeError: Cannot read property 'target' of undefined
      },
      () => {
        // 9. Library/Dependency Error - jQuery validation not loaded
        if (typeof $ !== 'undefined') {
          $(input).validate(); // TypeError: $(...).validate is not a function
        } else {
          // Simulate jQuery not loaded
          const jqueryValidator = window.jQuery;
          jqueryValidator.validate(); // ReferenceError: jQuery is not defined
        }
      }
    ]
  };
  
  const scenarios = errorScenarios[errorType];
  if (scenarios) {
    // Cycle through errors sequentially for predictable testing
    const errorIndex = (input.dataset.errorCount || 0) % scenarios.length;
    input.dataset.errorCount = (parseInt(input.dataset.errorCount || 0) + 1);
    
    console.error(`🚨 Form field error during ${errorType}: ${input.name || input.type}`);
    scenarios[errorIndex]();
  }
}

function simulateSubmitError(form) {
  const submitErrorScenarios = [
    () => {
      // 10. Async/API Submission Failure - Failed to fetch
      fetch('/api/non-existent-endpoint')
        .then(response => response.json())
        .catch(error => {
          throw new TypeError('Failed to fetch');
        });
    },
    () => {
      // 11. JSON Parsing Error - Unexpected token in JSON
      const invalidJson = '<html>Server Error</html>';
      JSON.parse(invalidJson); // SyntaxError: Unexpected token < in JSON at position 0
    },
    () => {
      // 12. Server Error Status Code
      const mockResponse = { status: 500 };
      if (mockResponse.status >= 400) {
        throw new Error('Request failed with status code 500');
      }
    },
    () => {
      // 13. reCAPTCHA Library Error
      if (typeof grecaptcha === 'undefined') {
        throw new ReferenceError('grecaptcha is not defined');
      } else {
        grecaptcha.verify('invalid-token');
      }
    },
    () => {
      // 14. File Upload Processing Error
      const fileInput = form.querySelector('input[type="file"]');
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileSize = file.size;
        if (fileSize > 10 * 1024 * 1024) { // 10MB limit
          throw new RangeError('File size exceeds maximum limit');
        }
      }
    },
    () => {
      // 15. Data Encoding Error - URI malformed
      const formData = new FormData(form);
      const encodedData = encodeURIComponent(formData.get('firstName') || '');
      decodeURIComponent(encodedData + '%E0%A4'); // URIError: URI malformed
    },
    () => {
      // 16. Object Conversion Error
      const formData = new FormData(form);
      const dataObject = Object.keys(formData); // TypeError: Cannot convert undefined or null to object
    },
    () => {
      // 17. Date Parsing Error
      const dateInput = form.querySelector('input[type="date"]');
      if (dateInput && dateInput.value) {
        const invalidDate = new Date('invalid-date-string');
        invalidDate.toISOString(); // RangeError: Invalid time value
      }
    },
    () => {
      // 18. Framework Component Error
      const vueComponent = window.VueComponent;
      if (vueComponent) {
        vueComponent.submitForm(); // TypeError: VueComponent.submitForm is not a function
      }
    },
    () => {
      // 19. Event Listener Configuration Error
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.addEventListener('click', (e) => {
        e.preventDefault(); // This will work, but let's simulate a passive listener error
        throw new Error('Event listener configuration error');
      }, { passive: true });
    }
  ];
  
  const randomSubmitError = submitErrorScenarios[Math.floor(Math.random() * submitErrorScenarios.length)];
  console.error('🚨 Form submission error occurred - user abandoned registration process');
  randomSubmitError();
}
