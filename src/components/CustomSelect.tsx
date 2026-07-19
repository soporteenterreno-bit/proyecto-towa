import React, { useState, useEffect, useRef } from 'react';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; subLabel?: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string; // For the inner display box
  containerClassName?: string; // For the outer wrapper
  required?: boolean;
  searchable?: boolean;
  dropdownPosition?: 'bottom' | 'top';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Selecciona...', 
  disabled = false,
  className = '',
  containerClassName = '',
  required = false,
  searchable = false,
  dropdownPosition = 'bottom'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const selectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  const displayLabel = options.find(o => o.value === value)?.label || value || placeholder;
  const filteredOptions = searchable 
    ? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()) || o.value.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

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
        <div className={`absolute z-10 w-full ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white border border-gray-100 rounded-lg shadow-xl max-h-60 flex flex-col`}>
          {searchable && (
            <div className="p-2 border-b border-gray-100 sticky top-0 bg-gray-50/90 backdrop-blur-sm z-10">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/20 transition-all bg-white"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto">
            {filteredOptions.map((opt, idx) => (
              <div 
                key={idx} 
                className={`p-2.5 hover:bg-gray-50 cursor-pointer text-sm flex justify-between items-center ${value === opt.value ? 'bg-gray-50 font-medium text-brand-dark' : 'text-gray-700'}`}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
              >
                <span className="truncate pr-2">{opt.label}</span>
                {opt.subLabel && <span className="text-[10px] font-bold text-gray-400 w-8 text-right flex-shrink-0">{opt.subLabel}</span>}
              </div>
            ))}
            {filteredOptions.length === 0 && <div className="p-2 text-sm text-gray-500 text-center">No hay opciones</div>}
          </div>
        </div>
      )}
    </div>
  );
};
