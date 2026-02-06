# Liquid Glass Toggle Component

A premium toggle switch component with a unique glass morphing effect. When clicked or dragged, the white pill thumb expands into a transparent glass stadium that slides to the other side, then morphs back into a solid white pill.

## Features

- **Drag interaction**: Grab and drag the thumb to toggle
- **Click animation**: Click anywhere to see the glass expand, slide, and shrink
- **Glass effect**: Transparent, slightly blurred glass stadium during transition
- **Smooth transitions**: 0.3s cubic-bezier animations for fluid motion
- **Track color change**: Grey to green when thumb passes halfway

---

## HTML Structure

```html
<label class="liquidGlassToggle">
    <input type="checkbox" id="myToggle">
    <div class="toggleTrack">
        <div class="toggleThumb"></div>
    </div>
</label>
```

### Size Variants

```html
<!-- Small -->
<label class="liquidGlassToggle small">...</label>

<!-- Default (medium) -->
<label class="liquidGlassToggle">...</label>

<!-- Large -->
<label class="liquidGlassToggle large">...</label>
```

### Disabled State

```html
<label class="liquidGlassToggle disabled">
    <input type="checkbox" disabled>
    ...
</label>
```

---

## CSS (styles.css)

Add the following to your global stylesheet. The CSS is already in `styles.css` starting around line 408.

```css
.liquidGlassToggle {
    position: relative;
    display: inline-flex;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    caret-color: transparent;
}

/* Ensure no caret/animation on toggle elements */
.liquidGlassToggle span,
.liquidGlassToggle .toggleTrack,
.liquidGlassToggle .toggleThumb {
    border-right: none !important;
    animation: none !important;
    caret-color: transparent;
}

.liquidGlassToggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
}

/* Track - the pill-shaped background */
.liquidGlassToggle .toggleTrack {
    position: relative;
    width: 72px;
    height: 32px;
    border-radius: 9999px;
    background: #c8c8c8;
    box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.12),
        inset 0 1px 2px rgba(0, 0, 0, 0.08);
    transition: background 0.3s ease;
    overflow: visible;
}

.liquidGlassToggle .toggleTrack::before,
.liquidGlassToggle .toggleTrack::after {
    display: none;
}

/* Thumb - stadium shape (landscape) */
.liquidGlassToggle .toggleThumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 40px;
    height: 26px;
    border-radius: 9999px;
    background: #ffffff;
    border: 2px solid transparent;
    box-shadow:
        0 2px 6px rgba(0, 0, 0, 0.15),
        0 1px 2px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(0px);
    -webkit-backdrop-filter: blur(0px);
    transition:
        left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        top 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        height 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        background 0.25s ease,
        border 0.25s ease,
        box-shadow 0.25s ease,
        backdrop-filter 0.25s ease,
        -webkit-backdrop-filter 0.25s ease;
    z-index: 3;
    cursor: grab;
}

.liquidGlassToggle .toggleThumb:active {
    cursor: grabbing;
}

/* Dragging state - glass stadium pill, LANDSCAPE (wider than tall) */
/* Glass overflows left/right sides horizontally */
.liquidGlassToggle.dragging .toggleThumb {
    top: -4px;
    width: 64px;
    height: 40px;
    background: rgba(255, 255, 255, 0.15);
    border: 2px solid rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(0.5px);
    -webkit-backdrop-filter: blur(0.5px);
    box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.05),
        inset 0 1px 2px rgba(255, 255, 255, 0.3),
        inset 0 -1px 2px rgba(0, 0, 0, 0.02);
}

/* Checked State - Green track, solid white thumb inside */
.liquidGlassToggle input:checked + .toggleTrack {
    background: #34c759;
}

.liquidGlassToggle input:checked + .toggleTrack .toggleThumb {
    left: 29px; /* 72px - 40px - 3px */
}

/* Track transition to green when thumb passes halfway (during drag) */
.liquidGlassToggle .toggleTrack.green {
    background: #34c759;
}

/* Hover States */
.liquidGlassToggle:hover .toggleTrack {
    box-shadow:
        0 3px 12px rgba(0, 0, 0, 0.15),
        inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

.liquidGlassToggle:hover input:checked + .toggleTrack {
    box-shadow:
        0 3px 12px rgba(52, 199, 89, 0.3),
        inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

/* Focus State */
.liquidGlassToggle input:focus-visible + .toggleTrack {
    outline: 2px solid #34c759;
    outline-offset: 2px;
}

/* Disabled State */
.liquidGlassToggle.disabled,
.liquidGlassToggle input:disabled + .toggleTrack {
    opacity: 0.5;
    cursor: not-allowed;
}

.liquidGlassToggle input:disabled + .toggleTrack .toggleThumb {
    cursor: not-allowed;
}

/* Size Variants - Small */
.liquidGlassToggle.small .toggleTrack {
    width: 56px;
    height: 26px;
}

.liquidGlassToggle.small .toggleThumb {
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
}

.liquidGlassToggle.small input:checked + .toggleTrack .toggleThumb {
    left: 33px;
}

.liquidGlassToggle.small.dragging .toggleThumb {
    top: -6px;
    width: 44px;
    height: 38px;
}

/* Size Variants - Large */
.liquidGlassToggle.large .toggleTrack {
    width: 88px;
    height: 40px;
}

.liquidGlassToggle.large .toggleThumb {
    top: 5px;
    left: 5px;
    width: 30px;
    height: 30px;
}

.liquidGlassToggle.large input:checked + .toggleTrack .toggleThumb {
    left: 53px;
}

.liquidGlassToggle.large.dragging .toggleThumb {
    top: -10px;
    width: 68px;
    height: 60px;
}
```

---

## JavaScript (liquidGlassToggle.js)

The JavaScript file is located at `assets/js/liquidGlassToggle.js`.

### Import and Initialize

```javascript
import { initLiquidGlassToggle, initAllLiquidGlassToggles, setToggleState } from './assets/js/liquidGlassToggle.js';

// Initialize a single toggle with callback
const toggle = document.querySelector('.liquidGlassToggle');
initLiquidGlassToggle(toggle, (isChecked) => {
    console.log('Toggle changed:', isChecked);
});

// Initialize all toggles in a container
initAllLiquidGlassToggles(document, {
    'browserNotifications': (checked) => console.log('Browser:', checked),
    'telegramNotifications': (checked) => console.log('Telegram:', checked),
});

// Set state programmatically
setToggleState(toggle, true);  // Turn on
setToggleState(toggle, false); // Turn off
```

### API Reference

#### `initLiquidGlassToggle(toggleLabel, onChange)`

Initialize a single liquid glass toggle.

| Parameter | Type | Description |
|-----------|------|-------------|
| `toggleLabel` | `HTMLElement` | The `.liquidGlassToggle` label element |
| `onChange` | `Function` | Optional callback `(isChecked: boolean) => void` |

#### `initAllLiquidGlassToggles(container, callbacks)`

Initialize all toggles within a container.

| Parameter | Type | Description |
|-----------|------|-------------|
| `container` | `HTMLElement` | Container to search in (default: `document`) |
| `callbacks` | `Object` | Map of checkbox IDs to callback functions |

#### `setToggleState(toggleLabel, checked)`

Set the toggle state programmatically (no animation).

| Parameter | Type | Description |
|-----------|------|-------------|
| `toggleLabel` | `HTMLElement` | The `.liquidGlassToggle` label element |
| `checked` | `boolean` | The state to set |

---

## Key Dimensions

### Default Size (72x32 track)

| Element | Property | Value |
|---------|----------|-------|
| Track | width | 72px |
| Track | height | 32px |
| Thumb (normal) | width | 40px |
| Thumb (normal) | height | 26px |
| Thumb (normal) | top | 3px |
| Thumb (normal) | left (off) | 3px |
| Thumb (normal) | left (on) | 29px |
| Glass (dragging) | width | 64px |
| Glass (dragging) | height | 40px |
| Glass (dragging) | top | -4px |
| Glass (dragging) | left min | -16px |
| Glass (dragging) | left max | 24px |

### Animation Timing

| Animation | Duration | Easing |
|-----------|----------|--------|
| Position (left) | 0.3s | cubic-bezier(0.4, 0, 0.2, 1) |
| Size (width/height) | 0.25s | cubic-bezier(0.4, 0, 0.2, 1) |
| Background/border | 0.25s | ease |
| Track background | 0.3s | ease |

### Glass Effect Properties

```css
background: rgba(255, 255, 255, 0.15);  /* Very transparent */
border: 2px solid rgba(255, 255, 255, 0.4);
backdrop-filter: blur(0.5px);  /* Minimal blur - keeps it clear */
```

---

## Animation Sequence (Click)

1. **Expand** (immediate): Thumb expands to glass state, centered on current position
2. **Slide** (after 50ms): Glass slides to target position (left or right edge)
3. **Track color** (with slide): Track turns green when glass center passes halfway
4. **Shrink** (after 300ms): Glass morphs back to white pill at final position

---

## Complete JavaScript Implementation

```javascript
/**
 * Liquid Glass Toggle - Unified Component
 * Features: Drag interaction with glass expansion, smooth transitions
 */

export function initLiquidGlassToggle(toggleLabel, onChange = null) {
  if (!toggleLabel || toggleLabel.dataset.init === "true") return;

  const checkbox = toggleLabel.querySelector('input[type="checkbox"]');
  const track = toggleLabel.querySelector(".toggleTrack");
  const thumb = toggleLabel.querySelector(".toggleThumb");

  if (!checkbox || !track || !thumb) return;

  toggleLabel.dataset.init = "true";

  // Dimensions
  const trackWidth = 72;
  const thumbWidth = 40;
  const thumbDragWidth = 64;
  const padding = 3;
  const maxLeft = trackWidth - thumbWidth - padding; // 29px for normal state
  const minLeftDrag = -16;
  const maxLeftDrag = trackWidth - thumbDragWidth + 16; // 24px
  const halfway = trackWidth / 2;

  // State
  let isDragging = false;
  let hasDragged = false;
  let startX = 0;
  let currentX = 0;
  let thumbLeft = checkbox.checked ? maxLeft : padding;

  // Set initial visual state
  if (checkbox.checked) {
    track.classList.add("green");
  }

  // Update thumb position
  const updateThumbPosition = (left, animate = false) => {
    if (animate) {
      thumb.style.transition =
        "left 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease, border 0.25s ease, box-shadow 0.25s ease, backdrop-filter 0.25s ease";
    } else {
      thumb.style.transition =
        "top 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease, border 0.25s ease, box-shadow 0.25s ease, backdrop-filter 0.25s ease";
    }
    thumb.style.left = `${left}px`;
  };

  // Get center of thumb based on current state
  const getThumbCenter = (left, isDraggingState) => {
    const width = isDraggingState ? thumbDragWidth : thumbWidth;
    return left + width / 2;
  };

  // Update track color based on thumb position
  const updateTrackColor = (left) => {
    const center = getThumbCenter(left, isDragging);
    if (center > halfway) {
      track.classList.add("green");
    } else {
      track.classList.remove("green");
    }
  };

  // Commit the toggle state
  const commitState = (toChecked) => {
    const wasChecked = checkbox.checked;
    checkbox.checked = toChecked;
    toggleLabel.classList.remove("dragging");

    if (toChecked) {
      track.classList.add("green");
      updateThumbPosition(maxLeft, true);
      thumbLeft = maxLeft;
    } else {
      track.classList.remove("green");
      updateThumbPosition(padding, true);
      thumbLeft = padding;
    }

    if (wasChecked !== toChecked && onChange) {
      onChange(toChecked);
    }
  };

  // Handle drag start
  const onDragStart = (e) => {
    if (checkbox.disabled) return;

    isDragging = true;
    hasDragged = false;
    toggleLabel.classList.add("dragging");
    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

    const currentCenter = thumbLeft + thumbWidth / 2;
    currentX = currentCenter - thumbDragWidth / 2;
    currentX = Math.max(minLeftDrag, Math.min(maxLeftDrag, currentX));

    updateThumbPosition(currentX, false);
    thumb.style.cursor = "grabbing";
    e.preventDefault();
  };

  // Handle drag move
  const onDragMove = (e) => {
    if (!isDragging) return;

    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    const deltaX = clientX - startX;

    if (Math.abs(deltaX) > 3) {
      hasDragged = true;
    }

    let newLeft = currentX + deltaX;
    newLeft = Math.max(minLeftDrag, Math.min(maxLeftDrag, newLeft));

    updateThumbPosition(newLeft, false);
    updateTrackColor(newLeft);
    e.preventDefault();
  };

  // Handle drag end
  const onDragEnd = () => {
    if (!isDragging) return;

    isDragging = false;
    thumb.style.cursor = "grab";

    const currentLeft = parseFloat(thumb.style.left);
    const center = currentLeft + thumbDragWidth / 2;
    const shouldBeChecked = center > halfway;

    commitState(shouldBeChecked);
  };

  // Mouse events
  thumb.addEventListener("mousedown", onDragStart);
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);

  // Touch events
  thumb.addEventListener("touchstart", onDragStart, { passive: false });
  document.addEventListener("touchmove", onDragMove, { passive: false });
  document.addEventListener("touchend", onDragEnd);

  // Animated click
  const animatedToggle = (toChecked) => {
    const wasChecked = checkbox.checked;
    if (wasChecked === toChecked) return;

    // Step 1: Expand to glass state
    toggleLabel.classList.add("dragging");
    const currentCenter = thumbLeft + thumbWidth / 2;
    let glassLeft = currentCenter - thumbDragWidth / 2;
    glassLeft = Math.max(minLeftDrag, Math.min(maxLeftDrag, glassLeft));
    updateThumbPosition(glassLeft, false);

    // Step 2: Slide to target
    setTimeout(() => {
      const targetLeft = toChecked ? maxLeftDrag : minLeftDrag;
      updateThumbPosition(targetLeft, true);

      if (toChecked) {
        track.classList.add("green");
      } else {
        track.classList.remove("green");
      }

      // Step 3: Shrink back to white pill
      setTimeout(() => {
        const finalLeft = toChecked ? maxLeft : padding;
        toggleLabel.classList.remove("dragging");

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            updateThumbPosition(finalLeft, true);
            checkbox.checked = toChecked;
            thumbLeft = finalLeft;

            if (onChange) {
              onChange(toChecked);
            }
          });
        });
      }, 300);
    }, 50);
  };

  // Click handler
  toggleLabel.addEventListener("click", (e) => {
    if (checkbox.disabled) return;
    if (hasDragged) {
      hasDragged = false;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    animatedToggle(!checkbox.checked);
  });

  checkbox.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  checkbox.addEventListener("focus", () => {
    checkbox.blur();
  });

  updateThumbPosition(thumbLeft, false);
}

export function initAllLiquidGlassToggles(container = document, callbacks = {}) {
  const toggles = container.querySelectorAll(".liquidGlassToggle");
  toggles.forEach((toggle) => {
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    const callback = checkbox?.id ? callbacks[checkbox.id] : null;
    initLiquidGlassToggle(toggle, callback);
  });
}

export function setToggleState(toggleLabel, checked) {
  const checkbox = toggleLabel.querySelector('input[type="checkbox"]');
  const track = toggleLabel.querySelector(".toggleTrack");
  const thumb = toggleLabel.querySelector(".toggleThumb");

  if (!checkbox || !track || !thumb) return;

  const trackWidth = 72;
  const thumbWidth = 34;
  const padding = 3;
  const maxLeft = trackWidth - thumbWidth - padding;

  checkbox.checked = checked;

  if (checked) {
    track.classList.add("green");
    thumb.style.left = `${maxLeft}px`;
  } else {
    track.classList.remove("green");
    thumb.style.left = `${padding}px`;
  }
}
```

---

## Usage Checklist

1. Include `styles.css` (contains all toggle CSS)
2. Import from `assets/js/liquidGlassToggle.js`
3. Add HTML structure with `.liquidGlassToggle` class
4. Call `initLiquidGlassToggle()` or `initAllLiquidGlassToggles()` after DOM ready
5. Optionally pass callbacks to handle state changes
