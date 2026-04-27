(() => {
  const content = window.GAME_CONTENT;
  if (!content) {
    return;
  }

  const els = {
    title: document.getElementById("gameTitle"),
    subtitle: document.getElementById("gameSubtitle"),
    replyBubble: document.getElementById("replyBubble"),
    bubbleLayer: document.getElementById("bubbleLayer"),
    progressText: document.getElementById("progressText"),
    restartBtn: document.getElementById("restartBtn"),
    arena: document.getElementById("arena"),
    overlay: document.getElementById("finalOverlay"),
    finalTitle: document.getElementById("finalTitle"),
    finalMessage: document.getElementById("finalMessage"),
    yesBtn: document.getElementById("yesBtn"),
    moreBtn: document.getElementById("moreBtn"),
    resultLine: document.getElementById("resultLine")
  };

  const state = {
    bubbles: [],
    activeCount: 0,
    audioCtx: null,
    lastFrameTime: 0,
    rafId: null,
    packIndex: 0
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getPacks() {
    return Array.isArray(content.excusePacks) ? content.excusePacks : [];
  }

  function getCurrentPack() {
    const packs = getPacks();
    if (!packs.length) {
      return [];
    }
    const normalizedIndex = ((state.packIndex % packs.length) + packs.length) % packs.length;
    return packs[normalizedIndex] || [];
  }

  function setUiText() {
    els.title.textContent = content.title;
    els.subtitle.textContent = content.subtitle;
    els.replyBubble.textContent = content.initialReply;
    els.restartBtn.textContent = content.restartLabel;
    els.yesBtn.textContent = content.acceptButton;
    els.moreBtn.textContent = content.moreButton;
    els.finalTitle.textContent = content.finalTitle;
    els.finalMessage.textContent = content.finalMessage;
  }

  function updateProgress() {
    els.progressText.textContent = `${content.progressLabel} ${state.activeCount}`;
  }

  function clearBubbles() {
    state.bubbles.forEach((bubble) => bubble.el.remove());
    state.bubbles = [];
    state.activeCount = 0;
    updateProgress();
  }

  function randomBubbleSize(totalCount) {
    const bounds = getLayerBounds();
    const isCompact = bounds.width < 390;
    let min = isCompact ? 74 : 84;
    let max = isCompact ? 108 : 122;

    if (totalCount >= 9) {
      min -= 6;
      max -= 8;
    }

    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function getLayerBounds() {
    const rect = els.bubbleLayer.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height
    };
  }

  function getAudioContext() {
    if (!state.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = Ctx ? new Ctx() : null;
    }
    return state.audioCtx;
  }

  function playPopSound() {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const tone = 220 + Math.random() * 220;

    osc.type = Math.random() > 0.5 ? "triangle" : "square";
    osc.frequency.setValueAtTime(tone, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.11);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  function showReply(text) {
    els.replyBubble.classList.remove("is-visible");
    void els.replyBubble.offsetWidth;
    els.replyBubble.textContent = text;
    els.replyBubble.classList.add("is-visible");
  }

  function finishRoundIfNeeded() {
    if (state.activeCount > 0) {
      return;
    }

    els.arena.classList.add("is-win");
    els.overlay.classList.remove("is-hidden");
    els.finalTitle.textContent = content.finalTitle;
    els.finalMessage.textContent = content.finalMessage;
  }

  function removeBubbleFromState(targetId) {
    state.bubbles = state.bubbles.filter((bubble) => bubble.id !== targetId);
  }

  function popBubble(bubbleObj) {
    if (bubbleObj.popped) {
      return;
    }

    bubbleObj.popped = true;
    bubbleObj.el.classList.add("is-popping");
    bubbleObj.el.style.pointerEvents = "none";
    playPopSound();
    showReply(bubbleObj.reply);

    state.activeCount -= 1;
    updateProgress();

    window.setTimeout(() => {
      bubbleObj.el.remove();
      removeBubbleFromState(bubbleObj.id);
      finishRoundIfNeeded();
    }, 220);
  }

  function makeBubble(item, index, totalCount) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "excuse-bubble";
    el.textContent = item.excuse;

    const bounds = getLayerBounds();
    const size = randomBubbleSize(totalCount);
    const margin = 6;
    const startX = margin + Math.random() * Math.max(10, bounds.width - size - margin * 2);
    const startY = margin + Math.random() * Math.max(10, bounds.height - size - margin * 2);

    const bubbleObj = {
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      el,
      reply: item.reply,
      x: startX,
      y: startY,
      size,
      vx: (Math.random() * 0.9 + 0.4) * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() * 0.7 + 0.35) * (Math.random() > 0.5 ? 1 : -1),
      popped: false
    };

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${bubbleObj.x}px`;
    el.style.top = `${bubbleObj.y}px`;

    el.addEventListener("click", () => popBubble(bubbleObj));

    state.bubbles.push(bubbleObj);
    els.bubbleLayer.appendChild(el);
  }

  function spawnRound(items, introText) {
    clearBubbles();

    const list = shuffle(items);
    list.forEach((item, idx) => makeBubble(item, idx, list.length));
    state.activeCount = list.length;

    updateProgress();
    els.overlay.classList.add("is-hidden");
    els.resultLine.textContent = "";
    els.arena.classList.remove("is-win");
    showReply(introText || content.initialReply);
  }

  function spawnCurrentPack(introText) {
    const currentPack = getCurrentPack();
    spawnRound(currentPack, introText);
  }

  function nextPack() {
    const packs = getPacks();
    if (!packs.length) {
      return;
    }
    state.packIndex = (state.packIndex + 1) % packs.length;
    spawnCurrentPack(content.nextPackReply);
  }

  function animateBubbles(timestamp) {
    if (!state.lastFrameTime) {
      state.lastFrameTime = timestamp;
    }

    const dt = clamp((timestamp - state.lastFrameTime) / 16, 0.5, 2);
    state.lastFrameTime = timestamp;

    const bounds = getLayerBounds();

    for (const bubble of state.bubbles) {
      if (bubble.popped) {
        continue;
      }

      bubble.x += bubble.vx * dt;
      bubble.y += bubble.vy * dt;

      if (bubble.x <= 0) {
        bubble.x = 0;
        bubble.vx *= -1;
      }
      if (bubble.x >= bounds.width - bubble.size) {
        bubble.x = bounds.width - bubble.size;
        bubble.vx *= -1;
      }
      if (bubble.y <= 0) {
        bubble.y = 0;
        bubble.vy *= -1;
      }
      if (bubble.y >= bounds.height - bubble.size) {
        bubble.y = bounds.height - bubble.size;
        bubble.vy *= -1;
      }

      bubble.el.style.left = `${bubble.x}px`;
      bubble.el.style.top = `${bubble.y}px`;
    }

    state.rafId = window.requestAnimationFrame(animateBubbles);
  }

  function initEvents() {
    els.restartBtn.addEventListener("click", () => {
      state.packIndex = 0;
      spawnCurrentPack(content.initialReply);
    });

    els.moreBtn.addEventListener("click", () => {
      nextPack();
    });

    els.yesBtn.addEventListener("click", () => {
      els.resultLine.textContent = content.acceptResult;
    });

    window.addEventListener("resize", () => {
      const bounds = getLayerBounds();
      state.bubbles.forEach((bubble) => {
        bubble.x = clamp(bubble.x, 0, Math.max(0, bounds.width - bubble.size));
        bubble.y = clamp(bubble.y, 0, Math.max(0, bounds.height - bubble.size));
        bubble.el.style.left = `${bubble.x}px`;
        bubble.el.style.top = `${bubble.y}px`;
      });
    });
  }

  function init() {
    setUiText();
    initEvents();
    spawnCurrentPack(content.initialReply);

    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
    }
    state.rafId = window.requestAnimationFrame(animateBubbles);
  }

  init();
})();
