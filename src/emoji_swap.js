'use strict';

// Prevent double init
if (typeof window.culmsEmojiSwapInitialized === 'undefined') {
	window.culmsEmojiSwapInitialized = true;

	// ── Emoji maps (include VS16 variants where it matters)
	const toHearts = new Map([
		['🔵', '💙'],
		['🔴', '❤️'],
		['⚫️', '🖤'], // U+26AB + VS16
		['⚫', '🖤'], // U+26AB (no VS16)
	]);

	// Inverse map for reverting back to circles
	const toCircles = new Map([
		['💙', '🔵'],
		['❤️', '🔴'],
		['🖤', '⚫️'], // prefer the VS16 "⚫️" appearance on revert
	]);

	let currentEnabled = false; // remember the current mode

	// Generic replace helper for a string using a Map
	function replaceWithMap(str, map) {
		let out = str;
		for (const [from, to] of map) {
			if (out.includes(from)) out = out.split(from).join(to);
		}
		return out;
	}

	// Replace in a single text node for a given direction ("enable" = toHearts, "disable" = toCircles)
	function replaceInTextNode(textNode, enable) {
		if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
		const map = enable ? toHearts : toCircles;
		const next = replaceWithMap(textNode.nodeValue, map);
		if (next !== textNode.nodeValue) textNode.nodeValue = next;
	}

	// Walk a subtree (regular DOM or an open shadow root)
	function replaceInSubtree(root, enable) {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
		let node;
		while ((node = walker.nextNode())) {
			replaceInTextNode(node, enable);
		}
	}

	// Apply across the document and open shadow roots
	function runSwap(enable) {
		replaceInSubtree(document.body, enable);
		document.querySelectorAll('*').forEach(el => {
			if (el.shadowRoot) replaceInSubtree(el.shadowRoot, enable);
		});
	}

	// Observe DOM changes and keep applying the current mode
	const observer = new MutationObserver(muts => {
		for (const m of muts) {
			if (m.type === 'characterData') {
				replaceInTextNode(m.target, currentEnabled);
			} else if (m.type === 'childList') {
				m.addedNodes.forEach(node => {
					if (node.nodeType === Node.TEXT_NODE) {
						replaceInTextNode(node, currentEnabled);
					} else if (node.nodeType === Node.ELEMENT_NODE) {
						replaceInSubtree(node, currentEnabled);
						if (node.shadowRoot) replaceInSubtree(node.shadowRoot, currentEnabled);
					}
				});
			}
		}
	});

	// Start (enable = hearts) or stop (disable = circles + stop observing)
	function startOrStop(enabled) {
		currentEnabled = !!enabled;

		if (currentEnabled) {
			// Turn circles → hearts and keep it up-to-date
			runSwap(true);
			observer.observe(document.body, { subtree: true, childList: true, characterData: true });
		} else {
			// Immediately revert hearts → circles, then stop watching
			observer.disconnect();
			runSwap(false);
		}
	}

	// React to storage changes (flip live without refresh)
	browser.storage.onChanged.addListener(changes => {
		if (changes.emojiHeartsEnabled) {
			startOrStop(!!changes.emojiHeartsEnabled.newValue);
		}
	});

	// Initialize on load based on current setting
	browser.storage.sync.get('emojiHeartsEnabled').then(data => {
		startOrStop(!!data.emojiHeartsEnabled);
	}).catch(() => {
		// if storage read fails, default to disabled (circles)
		startOrStop(false);
	});
}
