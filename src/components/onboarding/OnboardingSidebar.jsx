import React from 'react';

const OnboardingSidebar = ({ steps, currentStep, onStepClick }) => {
  return (
    <div className="onboarding-sidebar">
      <div className="logo-section">
        <img
          src="/movepost-logo.png"
          alt="MovePost"
          className="onboarding-logo"
        />
      </div>
      
      <div className="steps-list">
        {steps.map((step) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep || step.completed;
          
          return (
            <div 
              key={step.number} 
              className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => onStepClick && onStepClick(step.number)}
            >
              <div className="step-number">
                {isCompleted ? '✓' : step.number}
              </div>
              <div className="step-content">
                <div className="step-title">{step.title}</div>
                <div className="step-subtitle">{step.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingSidebar;