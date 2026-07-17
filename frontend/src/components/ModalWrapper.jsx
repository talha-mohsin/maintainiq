import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * ModalWrapper - a reusable, accessible modal component.
 * Props:
 *   isOpen: boolean – controls visibility
 *   onClose: () => void – called when modal should close (Esc, backdrop click, close button)
 *   title?: string – optional header title
 *   children: React.ReactNode – modal body content
 *   size?: string – optional Tailwind width class (e.g., 'max-w-lg')
 */
export default function ModalWrapper({ isOpen, onClose, title, children, size = 'max-w-lg' }) {
  const backdropRef = useRef(null);
  const firstFocusableRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Focus trap: focus first focusable element when opened
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onMouseDown={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full ${size} mx-4 relative`}>
        <button
          ref={firstFocusableRef}
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
        {title && <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>}
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
