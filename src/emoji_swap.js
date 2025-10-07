'use strict';

// Prevent double init
if (typeof window.culmsEmojiSwapInitialized === 'undefined') {
	window.culmsEmojiSwapInitialized = true;

	/**
	 * Mapping of source emojis to heart counterparts
	 */
	const emojiMap = new Map([
		['🔵', '💙'],
		['🔴', '❤️'],
		['⚫️', '🖤'],
	]);

	/**
	 * Replace emojis within a text node using emojiMap
	 */
	function replaceInTextNode(textNode) {
		if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
		let text = textNode.nodeValue;
		let replaced = false;
		emojiMap.forEach((to, from) => {
			if (text.includes(from)) {
				text = text.split(from).join(to);
				replaced = true;
			}
		});
		if (replaced) {
			textNode.nodeValue = text;
		}
	}

	/**
	 * Walk a subtree and replace emojis in text nodes
	 */
	function replaceInSubtree(root) {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
		let node;
		while ((node = walker.nextNode())) {
			replaceInTextNode(node);
		}
	}

	/**
	 * Apply replacements across document
	 */
	function runEmojiSwap() {
		replaceInSubtree(document.body);
		// Also try common shadow roots on the site
		document.querySelectorAll('*').forEach(el => {
			if (el.shadowRoot) {
				replaceInSubtree(el.shadowRoot);
			}
		});
	}

	/**
	 * Observe DOM changes to keep replacements up-to-date
	 */
	const observer = new MutationObserver(mutations => {
		for (const m of mutations) {
			if (m.type === 'characterData') {
				replaceInTextNode(m.target);
			} else if (m.type === 'childList') {
				m.addedNodes.forEach(node => {
					if (node.nodeType === Node.TEXT_NODE) {
						replaceInTextNode(node);
					} else if (node.nodeType === Node.ELEMENT_NODE) {
						replaceInSubtree(node);
						if (node.shadowRoot) replaceInSubtree(node.shadowRoot);
					}
				});
			}
		}
	});

	function startOrStop(enabled) {
		if (enabled) {
			runEmojiSwap();
			observer.observe(document.body, { subtree: true, childList: true, characterData: true });
		} else {
			observer.disconnect();
		}
	}

	// React to storage changes
	browser.storage.onChanged.addListener((changes) => {
		if (changes.emojiHeartsEnabled) {
			startOrStop(!!changes.emojiHeartsEnabled.newValue);
		}
	});

	// Initialize on load based on current setting
	browser.storage.sync.get('emojiHeartsEnabled').then(data => {
		startOrStop(!!data.emojiHeartsEnabled);
	});
}


