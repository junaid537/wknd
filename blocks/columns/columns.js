export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);
  
  
  // Add error-triggering functionality to buttons within columns (including recent-articles)
  const buttons = block.querySelectorAll('a.button.primary, a.button.secondary');
  buttons.forEach((button, index) => {
    button.addEventListener('click', function(e) {
      // Prevent default navigation for testing purposes
      e.preventDefault();
      
      // Special handling for VIEW TRIP button - simulate realistic runtime errors
      if (button.textContent.trim() === 'VIEW TRIP') {
        // Simulate realistic JavaScript errors that would cause user frustration
        const realisticErrors = [
          () => { 
            // Simulate undefined function call
            const undefinedFunction = window.nonExistentFunction;
            undefinedFunction();
          },
          () => { 
            // Simulate accessing property of undefined
            const tripData = undefined;
            console.log(tripData.price);
          },
          () => { 
            // Simulate invalid array access
            const dates = [];
            dates[5].toDateString();
          },
          () => { 
            // Simulate invalid JSON parsing
            const invalidJson = '{invalid:json}';
            JSON.parse(invalidJson);
          },
          () => { 
            // Simulate network timeout
            const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 100));
            timeoutPromise.then(() => {
              const response = undefined;
              response.data.trips.forEach(trip => console.log(trip));
            });
          },
          () => { 
            // Simulate DOM manipulation error
            const nonExistentElement = document.getElementById('trip-details');
            nonExistentElement.innerHTML = 'Loading...';
          },
          () => { 
            // Simulate type mismatch
            const price = 'invalid-price';
            const total = price * 1.1;
            total.toFixed(2);
          }
        ];
        
        const randomRealisticError = realisticErrors[Math.floor(Math.random() * realisticErrors.length)];
        console.error('⚠️ Runtime error occurred while processing VIEW TRIP request...');
        randomRealisticError();
        return;
      }
      
      // Regular error handling for other buttons (FULL ARTICLE, etc.)
      const errorTypes = [
        () => { throw new Error(`Columns button ${index} error: Something went wrong!`); },
        () => { throw new TypeError(`Columns button ${index} error: Invalid operation attempted`); },
        () => { throw new ReferenceError(`Columns button ${index} error: Undefined variable accessed`); },
        () => { throw new RangeError(`Columns button ${index} error: Value out of range`); },
        () => { throw new SyntaxError(`Columns button ${index} error: Invalid syntax detected`); }
      ];
      
      // Randomly select an error type
      const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      
      // Log the error to console and then throw it
      console.error(`JS Error Agent Test: Columns button "${button.textContent}" clicked, triggering error...`);
      randomError();
    });
  });
}
