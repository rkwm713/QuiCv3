import React from 'react';

interface IconButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  disabled = false,
  className = '',
  children,
  icon,
  title,
  variant = 'primary',
  size = 'md'
}) => {
  const getVariantStyles = () => {
    const variants = {
      primary: 'bg-gradient-to-r from-yellow-400 to-blue-500 hover:from-yellow-500 hover:to-blue-600 text-white border-transparent shadow-lg shadow-yellow-400/25',
      secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600 hover:border-slate-500',
      success: 'bg-gradient-to-r from-green-500 to-yellow-400 hover:from-green-600 hover:to-yellow-500 text-white border-transparent shadow-lg shadow-green-500/25',
      warning: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-transparent shadow-lg shadow-yellow-500/25',
      danger: 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white border-transparent shadow-lg shadow-red-500/25'
    };
    return variants[variant];
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };
    return sizes[size];
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        relative overflow-hidden rounded-lg border font-medium
        transition-all duration-300 transform
        hover:scale-105 hover:shadow-xl
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
        focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-slate-800
        flex items-center justify-center space-x-2
        ${getVariantStyles()}
        ${getSizeStyles()}
        ${className}
      `}
    >
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full hover:animate-shimmer" />
      
      {/* Button content */}
      <div className="relative flex items-center space-x-2">
        {icon && (
          <span className={`
            transition-transform duration-300
            ${disabled ? '' : 'group-hover:scale-110'}
          `}>
            {icon}
          </span>
        )}
        {children && <span>{children}</span>}
      </div>
    </button>
  );
};
