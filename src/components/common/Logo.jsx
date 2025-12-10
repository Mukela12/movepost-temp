import React from 'react';
import './Logo.css';

const Logo = ({ variant = 'default', className = '', size = 'default' }) => {
  return (
    <div className={`logo-container ${variant} ${size} ${className}`}>
      <img
        src="/movepost-logo.png"
        alt="MovePost"
        className="logo-image"
      />
    </div>
  );
};

export default Logo;