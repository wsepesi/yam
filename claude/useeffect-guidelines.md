# useEffect Guidelines

## ❌ DON'T Use Effects For:

**Transforming data for rendering**
```jsx
// ❌ Bad: Derived state + Effect
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(firstName + ' ' + lastName);
}, [firstName, lastName]);

// ✅ Good: Calculate during render
const fullName = firstName + ' ' + lastName;
```

**Updating state based on props/state**
```jsx
// ❌ Bad: Causes double render
useEffect(() => {
  setSelection(null);
}, [items]);

// ✅ Good: Reset with key or calculate derived state
```

**User events**
```jsx
// ❌ Bad: Effect triggered by state change from user action
useEffect(() => {
  if (product.isInCart) {
    showNotification('Added to cart!');
  }
}, [product]);

// ✅ Good: Handle in event directly
function handleBuy() {
  addToCart(product);
  showNotification('Added to cart!');
}
```

**State chains** - Multiple Effects updating state in sequence causes cascading re-renders

## ✅ DO Use Effects For:

- **External systems**: Network, timers, DOM events, 3rd party libs
- **Data fetching** (with cleanup for race conditions)
- **Subscriptions** that need cleanup

## 🔧 Quick Fixes:

| Instead of Effect for... | Use... |
|---|---|
| Expensive calculations | `useMemo(() => compute(), [deps])` |
| Resetting state on prop change | `key` prop |
| Parent notifications | Call `onChange` in event handler |
| External store subscriptions | `useSyncExternalStore` |

## 🎯 Decision Tree:

1. **Caused by rendering?** → Calculate during render
2. **Caused by user action?** → Event handler  
3. **Synchronizing with external system?** → Effect
4. **App initialization?** → Module-level code

## 🚨 Red Flags:
- Effect only updates state
- Multiple Effects in sequence
- Effect fires every render
- Complex dependency arrays
