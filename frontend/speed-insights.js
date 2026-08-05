/**
 * Vercel Speed Insights Integration
 * This file initializes Vercel Speed Insights for performance monitoring
 */

// Initialize Speed Insights using the vanilla JS approach
(function() {
  'use strict';
  
  // Create the Speed Insights queue
  window.si = window.si || function () { 
    (window.siq = window.siq || []).push(arguments); 
  };
  
  // Dynamically load the Speed Insights script
  // The script path will be available after deployment to Vercel
  // Format: /_vercel/speed-insights/script.js
  const script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  script.async = true;
  
  // Add error handling
  script.onerror = function() {
    console.warn('Vercel Speed Insights: Script failed to load. This is expected in local development.');
  };
  
  // Append script to document
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(script);
    });
  } else {
    document.head.appendChild(script);
  }
})();
