import { X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  open: boolean;
  handleClose: () => void;
}

export default function ReportName({ open, handleClose }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/report-missing-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email }),
      });

      if (!response.ok) throw new Error('Failed to submit report');
      
      // Reset form and close
      setName('');
      setEmail('');
      handleClose();
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#fffaf5] p-6 rounded-lg border-2 border-[#471803] w-full max-w-md relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-[#471803] hover:text-[#471803]/70 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-medium text-[#471803] mb-4">Report Missing Name</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#471803] mb-2">
              Student Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-[#471803] bg-[#fffaf5] focus:outline-none"
              placeholder="Enter student name"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#471803] mb-2">
              Student Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-[#471803] bg-[#fffaf5] focus:outline-none"
              placeholder="Enter student email"
              required
            />
          </div>
          
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-[#471803] hover:text-[#471803]/70 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 bg-[#471803] text-white hover:bg-[#471803]/90 transition-colors ${
                submitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 