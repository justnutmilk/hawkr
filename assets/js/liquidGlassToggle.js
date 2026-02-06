/**
 * Liquid Glass Toggle - Unified Component
 * Features: Drag interaction with glass expansion, smooth transitions
 */

/**
 * Initialize a liquid glass toggle with drag support
 * @param {HTMLElement} toggleLabel - The .liquidGlassToggle label element
 * @param {Function} onChange - Callback when toggle state changes
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
  // Glass overflows left/right
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

  // Update thumb position (no transition during drag)
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
    const width = isDraggingState ? thumbDragWidth : thumbSize;
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

    // Remove dragging class to return to normal thumb size
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

    // Add dragging class to expand thumb to glass state
    toggleLabel.classList.add("dragging");

    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

    // Recalculate position for the larger drag thumb
    // Center the expanded thumb where the small thumb was
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

    // Mark as dragged if moved more than 3px
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

    // Determine final state based on thumb position
    const currentLeft = parseFloat(thumb.style.left);
    const center = currentLeft + thumbDragWidth / 2;
    const shouldBeChecked = center > halfway;

    commitState(shouldBeChecked);
  };

  // Mouse events on thumb for dragging
  thumb.addEventListener("mousedown", onDragStart);
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);

  // Touch events on thumb for dragging
  thumb.addEventListener("touchstart", onDragStart, { passive: false });
  document.addEventListener("touchmove", onDragMove, { passive: false });
  document.addEventListener("touchend", onDragEnd);

  // Animated click - expand to glass, slide, then shrink back
  const animatedToggle = (toChecked) => {
    const wasChecked = checkbox.checked;
    if (wasChecked === toChecked) return;

    // Step 1: Expand to glass state
    toggleLabel.classList.add("dragging");

    // Center the glass where the thumb currently is
    const currentCenter = thumbLeft + thumbWidth / 2;
    let glassLeft = currentCenter - thumbDragWidth / 2;
    glassLeft = Math.max(minLeftDrag, Math.min(maxLeftDrag, glassLeft));
    updateThumbPosition(glassLeft, false);

    // Step 2: After glass expands, slide to target position
    setTimeout(() => {
      const targetLeft = toChecked ? maxLeftDrag : minLeftDrag;
      updateThumbPosition(targetLeft, true);

      // Update track color
      if (toChecked) {
        track.classList.add("green");
      } else {
        track.classList.remove("green");
      }

      // Step 3: After slide completes, shrink back to white pill smoothly
      setTimeout(() => {
        const finalLeft = toChecked ? maxLeft : padding;

        // Remove dragging class - CSS will smoothly morph glass to white pill
        toggleLabel.classList.remove("dragging");

        // Use requestAnimationFrame to ensure class change is applied before position change
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
      }, 300); // Wait for slide animation
    }, 50); // Small wait after expansion before sliding
  };

  // Click anywhere on toggle to switch state
  toggleLabel.addEventListener("click", (e) => {
    if (checkbox.disabled) return;

    // Don't toggle if we just finished dragging
    if (hasDragged) {
      hasDragged = false;
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    animatedToggle(!checkbox.checked);
  });

  // Prevent checkbox default behavior
  checkbox.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Prevent focus cursor
  checkbox.addEventListener("focus", () => {
    checkbox.blur();
  });

  // Set initial position
  updateThumbPosition(thumbLeft, false);
}

/**
 * Initialize all liquid glass toggles in a container
 */
export function initAllLiquidGlassToggles(
  container = document,
  callbacks = {},
) {
  const toggles = container.querySelectorAll(".liquidGlassToggle");
  toggles.forEach((toggle) => {
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    const callback = checkbox?.id ? callbacks[checkbox.id] : null;
    initLiquidGlassToggle(toggle, callback);
  });
}

/**
 * Set toggle state programmatically
 */
export function setToggleState(toggleLabel, checked) {
  const checkbox = toggleLabel.querySelector('input[type="checkbox"]');
  const track = toggleLabel.querySelector(".toggleTrack");
  const thumb = toggleLabel.querySelector(".toggleThumb");

  if (!checkbox || !track || !thumb) return;

  const trackWidth = 72;
  const thumbWidth = 40;
  const padding = 3;
  const maxLeft = trackWidth - thumbWidth - padding; // 29px

  checkbox.checked = checked;

  if (checked) {
    track.classList.add("green");
    thumb.style.left = `${maxLeft}px`;
  } else {
    track.classList.remove("green");
    thumb.style.left = `${padding}px`;
  }
}

/**
 * Initialize a mini liquid glass toggle (scaled down version)
 * @param {HTMLElement} toggleLabel - The .liquidGlassToggle.mini label element
 * @param {Function} onChange - Callback when toggle state changes
 */
export function initMiniLiquidGlassToggle(toggleLabel, onChange = null) {
  if (!toggleLabel || toggleLabel.dataset.init === "true") return;

  const checkbox = toggleLabel.querySelector('input[type="checkbox"]');
  const track = toggleLabel.querySelector(".toggleTrack");
  const thumb = toggleLabel.querySelector(".toggleThumb");

  if (!checkbox || !track || !thumb) return;

  toggleLabel.dataset.init = "true";

  // Small variant dimensions - stadium pill thumb
  // Track: 56x26, Thumb: 30x20, Glass: 48x38
  const trackWidth = 56;
  const thumbWidth = 30;
  const thumbDragWidth = 48;
  const padding = 3;
  const maxLeft = trackWidth - thumbWidth - padding; // 23px for normal state
  const minLeftDrag = -12;
  const maxLeftDrag = trackWidth - thumbDragWidth + 12; // 20px
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

  const getThumbCenter = (left, isDraggingState) => {
    const width = isDraggingState ? thumbDragWidth : thumbWidth;
    return left + width / 2;
  };

  const updateTrackColor = (left) => {
    const center = getThumbCenter(left, isDragging);
    if (center > halfway) {
      track.classList.add("green");
    } else {
      track.classList.remove("green");
    }
  };

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

  const onDragEnd = () => {
    if (!isDragging) return;

    isDragging = false;
    thumb.style.cursor = "grab";

    const currentLeft = parseFloat(thumb.style.left);
    const center = currentLeft + thumbDragWidth / 2;
    const shouldBeChecked = center > halfway;

    commitState(shouldBeChecked);
  };

  thumb.addEventListener("mousedown", onDragStart);
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);

  thumb.addEventListener("touchstart", onDragStart, { passive: false });
  document.addEventListener("touchmove", onDragMove, { passive: false });
  document.addEventListener("touchend", onDragEnd);

  const animatedToggle = (toChecked) => {
    const wasChecked = checkbox.checked;
    if (wasChecked === toChecked) return;

    toggleLabel.classList.add("dragging");

    const currentCenter = thumbLeft + thumbWidth / 2;
    let glassLeft = currentCenter - thumbDragWidth / 2;
    glassLeft = Math.max(minLeftDrag, Math.min(maxLeftDrag, glassLeft));
    updateThumbPosition(glassLeft, false);

    setTimeout(() => {
      const targetLeft = toChecked ? maxLeftDrag : minLeftDrag;
      updateThumbPosition(targetLeft, true);

      if (toChecked) {
        track.classList.add("green");
      } else {
        track.classList.remove("green");
      }

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
