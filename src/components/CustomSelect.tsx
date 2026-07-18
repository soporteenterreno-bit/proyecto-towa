import React, { useState, useEffect, useRef } from 'react';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string; // For the inner display box
  containerClassName?: string; // For the outer wrapper
  required?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Selecciona...', 
  disabled = false,
  className = '',
  containerClassName = '',
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = options.find(o => o.value === value)?.label || value || placeholder;

  // Set default styles if no specific className is provided
  const defaultBoxStyle = className ? className : "w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none text-sm";

  return (
    <div className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${containerClassName}`} ref={selectRef}>
      {/* Hidden input to handle required validation in standard HTML forms */}
      {required && (
        <input 
          type="text" 
          required 
          value={value} 
          onChange={() => {}} 
          className="absolute opacity-0 pointer-events-none w-0 h-0" 
          tabIndex={-1} 
        />
      )}
      <div 
        className={`${defaultBoxStyle} flex justify-between items-center cursor-pointer`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`truncate pr-2 ${!value ? 'text-gray-400' : ''}`}>{displayLabel}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8l4 4 4-4" />
        </svg>
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((opt, idx) => (
            <div 
              key={idx} 
              className={`p-2.5 hover:bg-gray-50 cursor-pointer text-sm ${value === opt.value ? 'bg-gray-50 font-medium text-brand-dark' : 'text-gray-700'}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
          {options.length === 0 && <div className="p-2 text-sm text-gray-500 text-center">No hay opciones</div>}
        </div>
      )}
    </div>
  );
};
