import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  accentColor?: 'blue' | 'emerald';
  hasError?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  accentColor = 'blue',
  hasError = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.subLabel?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeOptionClass =
    accentColor === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 font-medium'
      : 'bg-blue-50 text-blue-700 font-medium';

  const searchFocusClass =
    accentColor === 'emerald'
      ? 'focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
      : 'focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div
        className={`flex items-center justify-between w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg cursor-pointer transition-all ${
          hasError
            ? 'border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/20 focus-within:border-rose-500 bg-rose-50/10'
            : accentColor === 'emerald'
            ? 'border-slate-200 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500'
            : 'border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-900'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-2 flex-shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 flex-shrink-0 sticky top-0 bg-white z-10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                className={`w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none ${searchFocusClass}`}
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto overflow-x-hidden flex-1 p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-slate-500">No matches found</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`px-3 py-2 text-xs cursor-pointer rounded-lg break-words transition-colors ${
                    opt.value === value ? activeOptionClass : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <div className="font-medium">{opt.label}</div>
                  {opt.subLabel && <div className="text-[10px] text-slate-400 mt-0.5">{opt.subLabel}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
