// Import the custom element definitions
import './my-element';
import './counter-element';

/**
 * Main application entry point
 * This file dynamically creates and manipulates DOM elements
 */

function initializeApp() {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (!app) {
    console.error('App root element not found');
    return;
  }

  // Clear any existing content
  app.innerHTML = '';

  // Create the main element with slotted content
  const myElement = document.createElement('my-element');
  const heading = document.createElement('h1');
  heading.textContent = 'Vite + Lit HMR Demo (Dynamic DOM)';
  myElement.appendChild(heading);

  // Create a section for counter elements
  const counterSection = document.createElement('div');
  counterSection.style.marginTop = '2rem';

  // Create first counter element
  const counter1 = document.createElement('counter-element');

  // Add elements to the counter section
  counterSection.appendChild(counter1);

  // Add a button to dynamically add more counters
  const addButton = document.createElement('button');
  addButton.textContent = '+ Add Another Counter';
  addButton.style.cssText = `
    margin: 2rem auto;
    display: block;
    padding: 1rem 2rem;
    font-size: 1.1em;
    border-radius: 8px;
    border: 2px solid #646cff;
    background: #1a1a1a;
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
  `;

  addButton.addEventListener('mouseenter', () => {
    addButton.style.background = '#646cff';
    addButton.style.transform = 'translateY(-2px)';
  });

  addButton.addEventListener('mouseleave', () => {
    addButton.style.background = '#1a1a1a';
    addButton.style.transform = 'translateY(0)';
  });

  addButton.addEventListener('click', () => {
    const newCounter = document.createElement('counter-element');
    counterSection.appendChild(newCounter);
    console.log('Added new counter element');
  });

  // Assemble the app
  app.appendChild(myElement);
  app.appendChild(addButton);
  app.appendChild(counterSection);

  console.log('✅ App initialized with dynamic DOM manipulation');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Export for potential use in other modules
export { initializeApp };
