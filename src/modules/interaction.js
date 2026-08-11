/**
 * Pointer interaction wiring for rack/equipment tapping and hover cursor.
 */
export function attachPointerInteractions({
  canvas,
  camera,
  raycaster,
  pointerNdc,
  pickBlockers,
  interactiveItems,
  findInteractiveRoot,
  pressPtr,
  triggerPressFeedback,
  hideInfoPanel,
}) {
  function pickInteractive(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(
      pickBlockers.length ? pickBlockers.concat(interactiveItems) : interactiveItems,
      true
    );
    for (const hit of hits) {
      if (hit.object.userData && hit.object.userData.blocksPick) return null;
      const root = findInteractiveRoot(hit.object);
      if (root) return root;
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    pressPtr.x = e.clientX;
    pressPtr.y = e.clientY;
    pressPtr.down = true;
    pressPtr.moved = false;
  });

  canvas.addEventListener("pointermove", (e) => {
    if (pressPtr.down && Math.hypot(e.clientX - pressPtr.x, e.clientY - pressPtr.y) > 10) {
      pressPtr.moved = true;
    }
    const hit = pickInteractive(e.clientX, e.clientY);
    canvas.style.cursor = hit ? "pointer" : "";
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!pressPtr.down) return;
    const wasTap = !pressPtr.moved;
    pressPtr.down = false;
    if (!wasTap) return;
    const root = pickInteractive(e.clientX, e.clientY);
    if (root) triggerPressFeedback(root);
    else hideInfoPanel();
  });

  canvas.addEventListener("pointerleave", () => {
    pressPtr.down = false;
    canvas.style.cursor = "";
  });
}
