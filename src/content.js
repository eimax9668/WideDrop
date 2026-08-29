(() => {
  const EXTENSION_NAME = "WideDrop";
  const forwardedEvents = new WeakSet();
  let dragDepth = 0;
  let lastDrop = { signature: "", at: 0 };

  const textMatchers = [
    /message/i,
    /chat/i,
    /compose/i,
    /reply/i,
    /メッセージ/,
    /チャット/,
    /返信/,
    /送信/,
    /入力/
  ];

  const negativeTextMatchers = [
    /search/i,
    /filter/i,
    /検索/,
    /スペースを検索/,
    /ユーザーを検索/
  ];

  function isChatSurface() {
    return (
      location.hostname === "chat.google.com" ||
      location.hostname === "mail.google.com" ||
      location.pathname.endsWith("/test-harness.html")
    );
  }

  if (!isChatSurface()) return;

  function hasDraggedFiles(event) {
    const transfer = event.dataTransfer;
    if (!transfer) return false;

    const types = Array.from(transfer.types || []);
    if (types.some((type) => type.toLowerCase() === "files")) return true;

    return Array.from(transfer.items || []).some((item) => item.kind === "file");
  }

  function readFilesNow(transfer) {
    const files = [];

    for (const file of Array.from(transfer.files || [])) {
      if (file) files.push(file);
    }

    if (files.length > 0) return files;

    for (const item of Array.from(transfer.items || [])) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }

    return files;
  }

  function fileSignature(files) {
    return files
      .map((file) => [file.name, file.size, file.lastModified, file.type].join(":"))
      .join("|");
  }

  function consumeDuplicateDrop(files) {
    const signature = fileSignature(files);
    const now = Date.now();
    const isDuplicate = signature && signature === lastDrop.signature && now - lastDrop.at < 1200;
    lastDrop = { signature, at: now };
    return isDuplicate;
  }

  function ensureOverlay() {
    let overlay = document.getElementById("gcwd-drop-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "gcwd-drop-overlay";
      document.documentElement.appendChild(overlay);
    }
    return overlay;
  }

  function setOverlayVisible(visible) {
    ensureOverlay().dataset.visible = visible ? "true" : "false";
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= window.innerHeight &&
      rect.left <= window.innerWidth
    );
  }

  function fieldText(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("placeholder"),
      element.getAttribute("data-placeholder"),
      element.getAttribute("title"),
      element.textContent
    ]
      .filter(Boolean)
      .join(" ");
  }

  function scoreComposerCandidate(element) {
    if (!isVisible(element)) return -Infinity;

    const rect = element.getBoundingClientRect();
    const text = fieldText(element);
    let score = 0;

    if (element === document.activeElement) score += 80;
    if (element.matches('[role="textbox"]')) score += 35;
    if (element.matches('[contenteditable="true"]')) score += 35;
    if (element.matches("textarea")) score += 28;
    if (textMatchers.some((matcher) => matcher.test(text))) score += 38;
    if (negativeTextMatchers.some((matcher) => matcher.test(text))) score -= 85;

    const nearBottom = Math.max(0, window.innerHeight - rect.bottom);
    score += Math.max(0, 30 - nearBottom / 12);
    score += Math.min(rect.width / 30, 20);

    const container = element.closest('[role="main"], c-wiz, form, div');
    const containerText = container ? fieldText(container).slice(0, 1000) : "";
    if (/send|送信|upload|attach|添付|アップロード/i.test(containerText)) score += 14;

    return score;
  }

  function findComposer() {
    const active = document.activeElement;
    if (
      active instanceof Element &&
      active.matches('textarea, [contenteditable="true"], [role="textbox"]') &&
      scoreComposerCandidate(active) > 0
    ) {
      return active;
    }

    const candidates = Array.from(
      document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')
    )
      .map((element) => ({ element, score: scoreComposerCandidate(element) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.element || null;
  }

  function eventOptions(sourceEvent, transfer, dispatchTarget) {
    const target = dispatchTarget instanceof Element ? dispatchTarget : document.body;
    const rect = target.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    return {
      bubbles: true,
      cancelable: true,
      composed: true,
      dataTransfer: transfer,
      clientX,
      clientY,
      screenX: sourceEvent.screenX || clientX,
      screenY: sourceEvent.screenY || clientY,
      ctrlKey: sourceEvent.ctrlKey,
      altKey: sourceEvent.altKey,
      shiftKey: sourceEvent.shiftKey,
      metaKey: sourceEvent.metaKey
    };
  }

  function dispatchDropSequence(target, sourceEvent, transfer) {
    const dropTarget = target.closest('[role="textbox"]') || target;

    for (const type of ["dragenter", "dragover", "drop"]) {
      const event = new DragEvent(type, eventOptions(sourceEvent, transfer, dropTarget));
      forwardedEvents.add(event);
      dropTarget.dispatchEvent(event);
    }
  }

  function assignFilesToInput(files) {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'))
      .filter((input) => !input.disabled)
      .sort((a, b) => Number(isVisible(b)) - Number(isVisible(a)));

    for (const input of inputs) {
      try {
        const dt = new DataTransfer();
        for (const file of files) dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        return true;
      } catch {
        // Fallback failed
      }
    }

    return false;
  }

  function handleDragEnter(event) {
    if (forwardedEvents.has(event) || !hasDraggedFiles(event)) return;
    dragDepth += 1;
    setOverlayVisible(true);
  }

  function handleDragOver(event) {
    if (forwardedEvents.has(event) || !hasDraggedFiles(event)) return;
    const composer = findComposer();
    if (composer && event.target instanceof Node && composer.contains(event.target)) {
      setOverlayVisible(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setOverlayVisible(true);
  }

  function handleDragLeave(event) {
    if (forwardedEvents.has(event) || !hasDraggedFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setOverlayVisible(false);
  }

  function handleDrop(event) {
    if (forwardedEvents.has(event) || !hasDraggedFiles(event)) return;

    const files = readFilesNow(event.dataTransfer);
    const composer = findComposer();
    dragDepth = 0;
    setOverlayVisible(false);

    if (files.length === 0) {
      return;
    }

    if (consumeDuplicateDrop(files)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (composer && event.target instanceof Node && composer.contains(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (composer) {
      composer.focus({ preventScroll: true });
      dispatchDropSequence(composer, event, event.dataTransfer);
      return;
    }

    if (assignFilesToInput(files)) {
      return;
    }
  }

  document.addEventListener("dragenter", handleDragEnter, true);
  document.addEventListener("dragover", handleDragOver, true);
  document.addEventListener("dragleave", handleDragLeave, true);
  document.addEventListener("drop", handleDrop, true);
})();