import React from 'react';
import './ActionButtons.css';

const ActionButtons = ({ onEdit, onCopy, onRefresh, onDelete }) => {
  const handleClick = (e, callback) => {
    e.stopPropagation();
    if (callback) callback();
  };

  return (
    <div className="table-actions">
      {onEdit && (
        <button
          className="action-btn"
          onClick={(e) => handleClick(e, onEdit)}
          title="Edit"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.3 1.7L14.3 4.7L5 14H2V11L11.3 1.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      
      {onCopy && (
        <button
          className="action-btn"
          onClick={(e) => handleClick(e, onCopy)}
          title="Copy"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="6" y="6" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
      )}
      
      {onRefresh && (
        <button
          className="action-btn"
          onClick={(e) => handleClick(e, onRefresh)}
          title="Refresh"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8C14 11.3137 11.3137 14 8 14C5.73367 14 3.71873 12.8791 2.5 11.1708M2 8C2 4.68629 4.68629 2 8 2C10.2663 2 12.2813 3.12093 13.5 4.82918" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M2 4V8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 12V8H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      
      {onDelete && (
        <button
          className="action-btn delete"
          onClick={(e) => handleClick(e, onDelete)}
          title="Delete"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4H14M6 4V2.5C6 2.22386 6.22386 2 6.5 2H9.5C9.77614 2 10 2.22386 10 2.5V4M3 4L3.5 14H12.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default ActionButtons;