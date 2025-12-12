import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

const BASE =
    'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 shadow-sm',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-brand-500 shadow-sm',
    ghost: 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:ring-brand-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm',
};

const SIZES: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-lg px-6 py-3',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => {
        const cls = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
        return <button ref={ref} className={cls} {...props} />;
    }
);

Button.displayName = 'Button';

