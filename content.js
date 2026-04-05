(() => {
  const BUTTON_ID = 'ai-install-btn';
  const DROPDOWN_ID = 'ai-install-dropdown';

  function getRepoInfo() {
    // Match repo root and subpages like /tree/, /blob/, /issues, etc.
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    const [, owner, repo] = match;
    // Exclude GitHub system pages
    const reserved = [
      'settings', 'marketplace', 'explore', 'notifications', 'new',
      'login', 'signup', 'organizations', 'orgs', 'features', 'pricing',
      'sponsors', 'topics', 'trending', 'collections', 'events', 'about',
      'security', 'customer-stories',
    ];
    if (reserved.includes(owner)) return null;
    return { owner, repo: repo.replace(/\.git$/, '') };
  }

  function getCommands(owner, repo) {
    const url = `https://github.com/${owner}/${repo}`;
    return [
      {
        id: 'claude',
        label: 'Claude Code',
        icon: '🤖',
        command: `claude "clone ${url} and set it up following the README"`,
      },
      {
        id: 'cursor',
        label: 'Cursor',
        icon: '▶️',
        command: `cursor ${url}`,
      },
      {
        id: 'terminal',
        label: 'Terminal + Claude',
        icon: '💻',
        command: `git clone ${url} && cd ${repo} && claude "set up this project"`,
      },
    ];
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  }

  function showCopiedFeedback(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="ai-install-icon">✓</span> Copied!';
    btn.classList.add('ai-install-copied');
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('ai-install-copied');
    }, 1500);
  }

  function closeDropdown() {
    const existing = document.getElementById(DROPDOWN_ID);
    if (existing) existing.remove();
  }

  function createDropdown(owner, repo, anchorBtn) {
    closeDropdown();

    const dropdown = document.createElement('div');
    dropdown.id = DROPDOWN_ID;
    dropdown.className = 'ai-install-dropdown';

    chrome.storage.sync.get({ defaultClient: '', oneClick: false }, (settings) => {
      const commands = getCommands(owner, repo);

      // One-click mode: copy default immediately
      if (settings.oneClick && settings.defaultClient) {
        const cmd = commands.find((c) => c.id === settings.defaultClient);
        if (cmd) {
          copyToClipboard(cmd.command).then(() => showCopiedFeedback(anchorBtn));
          return;
        }
      }

      commands.forEach((cmd) => {
        const item = document.createElement('button');
        item.className = 'ai-install-dropdown-item';
        if (cmd.id === settings.defaultClient) {
          item.classList.add('ai-install-default');
        }
        item.innerHTML = `<span class="ai-install-item-icon">${cmd.icon}</span><span class="ai-install-item-label">${cmd.label}</span>`;
        item.addEventListener('click', async (e) => {
          e.stopPropagation();
          await copyToClipboard(cmd.command);
          closeDropdown();
          showCopiedFeedback(anchorBtn);
        });
        dropdown.appendChild(item);
      });

      // Badge snippet option
      const divider = document.createElement('div');
      divider.className = 'ai-install-divider';
      dropdown.appendChild(divider);

      const badgeItem = document.createElement('button');
      badgeItem.className = 'ai-install-dropdown-item ai-install-badge-item';
      badgeItem.innerHTML = '<span class="ai-install-item-icon">🏷️</span><span class="ai-install-item-label">Copy badge for README</span>';
      badgeItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        const badge = `[![Install with AI](https://img.shields.io/badge/Install_with-AI_%E2%9A%A1-blueviolet?style=for-the-badge)](https://github.com/${owner}/${repo})`;
        await copyToClipboard(badge);
        closeDropdown();
        showCopiedFeedback(anchorBtn);
      });
      dropdown.appendChild(badgeItem);

      anchorBtn.parentElement.appendChild(dropdown);
    });
  }

  function findCodeButton() {
    // Strategy 1: Find by text content (most reliable across GitHub updates)
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const text = btn.textContent.trim();
      if (text === 'Code' && btn.classList.contains('btn-primary')) return btn;
    }

    // Strategy 2: data-testid (official GitHub test attribute)
    const byTestId = document.querySelector('[data-testid="code-button"]');
    if (byTestId) return byTestId;

    // Strategy 3: Primer React button with Code text
    for (const btn of allButtons) {
      if (btn.textContent.trim() === 'Code' && btn.querySelector('[data-component="buttonContent"]')) return btn;
    }

    // Strategy 4: get-repo custom element
    const getRepo = document.querySelector('get-repo');
    if (getRepo) {
      const inner = getRepo.querySelector('.btn-primary') || getRepo.querySelector('button');
      if (inner) return inner;
    }

    // Strategy 5: green button with dropdown near clone URL
    const primary = document.querySelector('.btn-primary[aria-haspopup="menu"]');
    if (primary) return primary;

    // Strategy 6: BtnGroup with primary button in sidebar
    const sidebar = document.querySelector('.Layout-sidebar .btn-primary')
      || document.querySelector('[class*="BtnGroup"] .btn-primary');
    if (sidebar) return sidebar;

    return null;
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const info = getRepoInfo();
    if (!info) return;

    const anchor = findCodeButton();
    if (!anchor) return;

    const container = document.createElement('div');
    container.className = 'ai-install-container';
    container.style.position = 'relative';

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = 'ai-install-btn';
    btn.innerHTML = '<span class="ai-install-icon">⚡</span> Install with AI';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const existing = document.getElementById(DROPDOWN_ID);
      if (existing) {
        closeDropdown();
      } else {
        createDropdown(info.owner, info.repo, btn);
      }
    });

    container.appendChild(btn);

    // Insert after the Code button or its parent group
    const insertTarget = anchor.closest('.BtnGroup')
      || anchor.closest('[class*="ButtonGroup"]')
      || anchor.closest('get-repo')
      || anchor.parentElement;
    if (insertTarget && insertTarget.parentElement) {
      insertTarget.parentElement.insertBefore(container, insertTarget.nextSibling);
    }
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#${DROPDOWN_ID}`) && !e.target.closest(`#${BUTTON_ID}`)) {
      closeDropdown();
    }
  });

  // Initial injection
  injectButton();

  // Re-inject on GitHub SPA navigation (debounced)
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!document.getElementById(BUTTON_ID)) {
        injectButton();
      }
    }, 300);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also listen for GitHub turbo navigation
  document.addEventListener('turbo:load', () => {
    setTimeout(injectButton, 500);
  });
})();
