/**
 * QA Analysis Framework
 * 
 * This framework implements the Senior QA Manager "Casey" approach to
 * comprehensive quality assurance for software development.
 * 
 * Use this checklist for every function, component, or feature implementation.
 */

export interface QAAnalysisResult {
  functional: {
    userFlow: string[];
    happyPath: string;
    edgeCases: string[];
    stateManagement: string[];
  };
  uiUx: {
    iconography: string[];
    layout: string[];
    clarity: string[];
  };
  accessibility: {
    semanticHtml: string[];
    ariaRoles: string[];
    keyboardNavigation: string[];
    screenReader: string[];
  };
  errorHandling: {
    userFeedback: string[];
    gracefulFailure: string[];
    loadingStates: string[];
  };
  performance: {
    efficiency: string[];
    resourceManagement: string[];
  };
}

/**
 * QA Analysis Checklist Template
 * 
 * Apply this comprehensive analysis to every code request.
 */
export const QA_ANALYSIS_CHECKLIST = {
  functional: {
    userFlow: [
      "Does this function/UI element make sense in the context of the larger user journey?",
      "What are the entry and exit points?",
      "Are all user paths clearly defined?"
    ],
    happyPath: [
      "Does the code work as expected under ideal conditions?",
      "Are all success scenarios properly handled?"
    ],
    edgeCases: [
      "What happens with null/undefined inputs?",
      "What happens with empty strings or zero values?",
      "What happens with negative numbers?",
      "What happens with extremely large inputs?",
      "What happens with invalid data types?",
      "What happens with network failures?",
      "What happens with permission denied scenarios?"
    ],
    stateManagement: [
      "How does this affect the application's state?",
      "Is the state updated correctly?",
      "Are there any potential race conditions?",
      "Is state cleanup handled properly?"
    ]
  },
  uiUx: {
    iconography: [
      "Is the purpose of every icon immediately clear to a new user?",
      "Is it the right icon for the action?",
      "Are icons consistent across the application?",
      "Do icons have proper alternative text?"
    ],
    layout: [
      "Is the layout intuitive?",
      "Are elements properly aligned?",
      "Is there enough clickable space for mobile users (44px minimum)?",
      "Is spacing consistent with design system?"
    ],
    clarity: [
      "Are all labels clear, concise, and helpful?",
      "Are tooltips provided where needed?",
      "Are placeholder texts informative?",
      "Is the copy free of technical jargon?"
    ]
  },
  accessibility: {
    semanticHtml: [
      "Are the correct HTML tags being used for their intended purpose?",
      "Are headings properly structured (h1, h2, h3)?",
      "Are lists using proper list markup?",
      "Are forms using proper form elements?"
    ],
    ariaRoles: [
      "Are ARIA roles used correctly for interactive components?",
      "Are ARIA labels provided for complex interactions?",
      "Are ARIA live regions used for dynamic content?",
      "Are ARIA states properly managed?"
    ],
    keyboardNavigation: [
      "Can a user navigate using only a keyboard?",
      "Is the tab order logical?",
      "Are focus indicators visible?",
      "Can all interactive elements be accessed via keyboard?"
    ],
    screenReader: [
      "Will a screen reader announce the element's purpose correctly?",
      "Are state changes announced appropriately?",
      "Is sufficient context provided for complex interactions?"
    ]
  },
  errorHandling: {
    userFeedback: [
      "Are error messages clear and user-friendly?",
      "Do error messages provide actionable next steps?",
      "Is technical jargon avoided in user-facing messages?",
      "Are success messages clear and confirmatory?"
    ],
    gracefulFailure: [
      "Does the application handle failures without crashing?",
      "Are fallback states provided?",
      "Is data preserved when possible during failures?"
    ],
    loadingStates: [
      "Are loading indicators provided for async operations?",
      "Do loading states provide appropriate feedback?",
      "Are loading states accessible to screen readers?"
    ]
  },
  performance: {
    efficiency: [
      "Is the code efficient?",
      "Are there unnecessary loops or calculations?",
      "Are algorithms optimized appropriately?",
      "Is rendering optimized to avoid unnecessary re-renders?"
    ],
    resourceManagement: [
      "Are event listeners properly cleaned up?",
      "Are subscriptions properly managed?",
      "Is memory usage optimized?",
      "Are network requests optimized and cached when appropriate?"
    ]
  }
};

/**
 * Utility function to help document QA analysis for code reviews
 */
export function generateQAAnalysisTemplate(featureName: string): string {
  return `
/*
 * QA Analysis: ${featureName}
 *
 * Functional:
 * - Happy Path: [Describe ideal user interaction and expected outcome]
 * - Edge Cases: [List potential edge cases and how they're handled]
 * - State Management: [Describe state changes and potential issues]
 *
 * UI/UX:
 * - Icon: [Describe icon choice and clarity]
 * - Layout: [Describe layout considerations and mobile accessibility]
 * - Clarity: [Describe text clarity and user guidance]
 *
 * Accessibility:
 * - Semantic HTML: [Describe proper HTML element usage]
 * - ARIA: [Describe ARIA roles and labels]
 * - Keyboard Navigation: [Describe keyboard accessibility]
 * - Screen Reader: [Describe screen reader announcements]
 *
 * Error Handling:
 * - User Feedback: [Describe user-facing error and success messages]
 * - Graceful Failure: [Describe fallback behavior]
 * - Loading States: [Describe loading indicators and feedback]
 *
 * Performance:
 * - Efficiency: [Describe performance considerations]
 * - Resource Management: [Describe cleanup and optimization]
 */
`;
}

/**
 * Test case template generator
 */
export function generateTestCaseTemplate(featureName: string): string {
  return `
/*
 * Test Cases for ${featureName}:
 * 
 * Happy Path:
 * 1. [Describe successful user interaction]
 * 
 * Edge Cases:
 * 2. [Test with invalid/null data]
 * 3. [Test with network failure]
 * 4. [Test with permission denied]
 * 
 * Accessibility:
 * 5. [Test keyboard navigation]
 * 6. [Test screen reader announcements]
 * 
 * Error Handling:
 * 7. [Test error message display]
 * 8. [Test graceful failure behavior]
 */
`;
}