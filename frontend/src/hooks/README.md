# ESC Key Support for Modals

## Overview

We've implemented ESC key functionality to close modals/popups throughout the application. This provides a better user experience as users can quickly close modals without clicking the close button.

## How It Works

- **JavaScript/React Solution**: This is NOT a CSS feature. It uses React hooks to listen for keyboard events.
- **Reusable Hook**: We created a custom hook `useEscapeKey` that can be used in any component.
- **No Installation Needed**: Uses built-in React and browser APIs.

## Usage

### Basic Usage

Import the hook and use it in your component:

```tsx
import { useEscapeKey } from '../hooks/useEscapeKey';

const MyComponent = () => {
  const [showModal, setShowModal] = useState(false);

  // Add ESC key support
  useEscapeKey(() => {
    setShowModal(false);
  }, showModal);

  return (
    <>
      {showModal && (
        <div className="modal-overlay">
          {/* Modal content */}
        </div>
      )}
    </>
  );
};
```

### Advanced Usage

You can also reset form state when closing:

```tsx
useEscapeKey(() => {
  if (showModal) {
    setShowModal(false);
    setEditMode(false);
    setFormData({});
  }
}, showModal);
```

### Parameters

- `callback`: Function to execute when ESC is pressed
- `isActive`: Boolean to enable/disable the listener (usually the modal's open state)

## Examples in Our Codebase

1. **Colleges.tsx**: Added ESC support for both the "Add/Edit College" modal and "Import Colleges" modal
2. **Modal.tsx**: The reusable Modal component already has ESC support built-in

## Adding to Other Components

To add ESC key support to any modal in your project:

1. Import the hook:
```tsx
import { useEscapeKey } from '../hooks/useEscapeKey';
```

2. Add the hook after your state declarations:
```tsx
const [showMyModal, setShowMyModal] = useState(false);

useEscapeKey(() => {
  setShowMyModal(false);
}, showMyModal);
```

3. Done! Press ESC to close the modal.

## Benefits

- ✅ Better UX - users can close modals instantly
- ✅ Reusable - one hook for all modals
- ✅ No CSS needed - pure JavaScript/React
- ✅ Works globally - can be used in any component
- ✅ Clean implementation - follows React best practices

