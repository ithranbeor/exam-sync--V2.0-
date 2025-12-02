import { useEffect } from 'react';

/**
 * Custom hook to handle ESC key press to close modals/popups
 * @param callback - Function to call when ESC key is pressed
 * @param isActive - Whether the ESC key listener should be active (default: true)
 * 
 * @example
 * const [showModal, setShowModal] = useState(false);
 * useEscapeKey(() => setShowModal(false), showModal);
 */
export const useEscapeKey = (callback: () => void, isActive: boolean = true) => {
  useEffect(() => {
    if (!isActive) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        callback();
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleEscape);

    // Cleanup: remove event listener when component unmounts or isActive changes
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [callback, isActive]);
};

