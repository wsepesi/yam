import { ChevronDown, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props<T> {
  apiRoute: string;
  acLabel: string;
  displayOption: (option: T) => string;
  record: T | null;
  setRecord: (record: T | null) => void;
  setLoaded: (loaded: boolean) => void;
  actionButton?: React.ReactNode;
  headers?: Record<string, string>;
}

export default function AutocompleteWithDb<T>({ apiRoute, acLabel, displayOption, record, setRecord, setLoaded, actionButton, headers }: Props<T>) {
  const [options, setOptions] = useState<T[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch(`/api/${apiRoute}`, { headers });
        if (!response.ok) throw new Error('Failed to fetch options');
        const data = await response.json();
        setOptions(data.records || data);
        setLoading(false);
        setLoaded(true);
      } catch (error) {
        console.error('Error fetching options:', error);
        setLoading(false);
        setLoaded(true);
      }
    };

    fetchOptions();
  }, [apiRoute, setLoaded, headers]);

  const filteredOptions = options.filter(option =>
    displayOption(option).toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isOpen) setIsOpen(true);
    if (record) setRecord(null);
  };

  const handleOptionClick = (option: T) => {
    setRecord(option);
    setInputValue(displayOption(option));
    setIsOpen(false);
  };

  const handleClear = () => {
    setInputValue('');
    setRecord(null);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-md">
      <label className="block text-sm font-medium text-[#471803] mb-2">
        {acLabel}
      </label>
      <div className="relative flex border-2 border-[#471803] bg-[#fffaf5]">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className="flex-1 px-3 py-2 bg-transparent focus:outline-none text-[#471803]"
          placeholder="Search..."
        />
        <div className="flex">
          {inputValue && (
            <button
              onClick={handleClear}
              className="px-3 text-[#471803] hover:text-[#471803]/70 transition-colors border-l-2 border-[#471803]"
              aria-label="Clear"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 text-[#471803] hover:text-[#471803]/70 transition-colors border-l-2 border-[#471803]"
            aria-label="Toggle dropdown"
          >
            <ChevronDown size={16} />
          </button>
          {actionButton}
        </div>
      </div>
      
      {isOpen && !loading && (
        <div className="absolute z-10 w-full mt-1 bg-[#fffaf5] border-2 border-[#471803] max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={displayOption(option)}
                onClick={() => handleOptionClick(option)}
                className="w-full px-3 py-2 text-left hover:bg-[#471803]/10 text-[#471803] transition-colors"
              >
                {displayOption(option)}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[#471803]/70">No results found</div>
          )}
        </div>
      )}
    </div>
  );
} 