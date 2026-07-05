/* =============================================
   app.js — Shared UI logic (navbar, search,
   notifications, theme, toasts, post renderer)
   Loaded on index, profile, explore pages.
   ============================================= */

// ── Guard: redirect if not logged in ─────────
// requireAuth() redirects and returns false if not logged in.
// We throw to halt further script execution on this page.
if (!Auth.requireAuth()) throw new Error('Not authenticated');

const me = Auth.currentUser();

/* ══════════════════════════════════════════════
   THEME
══════════════════════════════════════════════ */
(function initTheme() {
  const saved = localStorage.getItem('ss_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.querySelector('i').className = saved === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  btn.addEventListener('click', () => {
    const cur  = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ss_theme', next);
    btn.querySelector('i').className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
})();

/* ══════════════════════════════════════════════
   NAVBAR — avatar + logout
══════════════════════════════════════════════ */
(function initNav() {
  const navAvatar = document.getElementById('navAvatar');
  if (navAvatar) navAvatar.src = me.avatar;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', e => { e.preventDefault(); Auth.logout(); });
})();

/* ══════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════ */
(function initSearch() {
  const input    = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchDropdown');
  if (!input || !dropdown) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      if (!q) { dropdown.classList.remove('open'); return; }
      const results = DB.Users.all().filter(u =>
        u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
      ).slice(0, 6);

      dropdown.innerHTML = '';
      if (results.length === 0) {
        dropdown.innerHTML = '<p style="padding:12px 14px;color:var(--text-muted);font-size:.88rem;">No users found.</p>';
      } else {
        results.forEach(u => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.innerHTML = `
            <img src="${u.avatar}" alt="${u.displayName}" />
            <div>
              <div class="sr-name">${u.displayName}</div>
              <div class="sr-handle">@${u.username}</div>
            </div>`;
          item.addEventListener('click', () => {
            window.location.href = `profile.html?u=${u.username}`;
          });
          dropdown.appendChild(item);
        });
      }
      dropdown.classList.add('open');
    }, 220);
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
})();

/* ══════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════ */
function updateNotifBadge() {
  const count  = DB.Notifications.unreadCount(me.id);
  const badge  = document.getElementById('notifBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderNotifPanel() {
  const list    = document.getElementById('notifList');
  const empty   = document.getElementById('notifEmpty');
  const notifs  = DB.Notifications.forUser(me.id);
  if (!list) return;

  list.innerHTML = '';
  if (notifs.length === 0) {
    empty && (empty.style.display = 'block');
    return;
  }
  empty && (empty.style.display = 'none');

  notifs.forEach(n => {
    const actor = DB.Users.find(n.actorId);
    if (!actor) return;
    const li = document.createElement('li');
    li.innerHTML = `
      <img src="${actor.avatar}" alt="${actor.displayName}" />
      <span class="notif-msg"><strong>${actor.displayName}</strong> ${n.text}</span>
      <span class="notif-time">${timeAgo(n.createdAt)}</span>`;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      if (n.postId) {
        // highlight post (just navigate to feed for now)
        window.location.href = 'index.html';
      } else {
        window.location.href = `profile.html?u=${actor.username}`;
      }
    });
    list.appendChild(li);
  });
}

(function initNotifications() {
  const btn     = document.getElementById('notifBtn');
  const panel   = document.getElementById('notifPanel');
  const overlay = document.getElementById('notifOverlay');
  const clearBtn = document.getElementById('clearNotifs');
  if (!btn || !panel) return;

  updateNotifBadge();

  btn.addEventListener('click', e => {
    e.preventDefault();
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      overlay.classList.remove('open');
    } else {
      renderNotifPanel();
      panel.classList.add('open');
      overlay.classList.add('open');
      DB.Notifications.markAllRead(me.id);
      updateNotifBadge();
    }
  });

  overlay && overlay.addEventListener('click', () => {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  });

  clearBtn && clearBtn.addEventListener('click', () => {
    DB.Notifications.clearAll(me.id);
    renderNotifPanel();
    updateNotifBadge();
  });
})();

/* ══════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════ */
function showToast(message, type = 'default', duration = 2800) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s ease, transform .3s ease';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ══════════════════════════════════════════════
   TIME HELPER
══════════════════════════════════════════════ */
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ══════════════════════════════════════════════
   LINKIFY — turn #tags and @mentions into links
══════════════════════════════════════════════ */
function linkify(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/#(\w+)/g, '<a href="explore.html?tag=$1">#$1</a>')
    .replace(/@(\w+)/g, '<a href="profile.html?u=$1">@$1</a>');
}

/* ══════════════════════════════════════════════
   POST CARD RENDERER  (shared by feed, profile, explore)
══════════════════════════════════════════════ */
function renderPost(post, container, { prepend = false } = {}) {
  const author  = DB.Users.find(post.authorId);
  if (!author) return;
  const isOwner = post.authorId === me.id;
  const liked   = post.likes.includes(me.id);

  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.postId = post.id;

  card.innerHTML = `
    <div class="post-header">
      <img src="${author.avatar}" alt="${author.displayName}" class="post-avatar"
           data-username="${author.username}" />
      <div class="post-user-info">
        <span class="post-display-name" data-username="${author.username}">${author.displayName}</span>
        <div class="post-handle">@${author.username}</div>
      </div>
      <span class="post-time">${timeAgo(post.createdAt)}</span>
      ${isOwner ? `
        <div style="position:relative">
          <button class="post-menu-btn" title="More"><i class="fa-solid fa-ellipsis"></i></button>
          <div class="post-menu-dropdown">
            <button class="delete-btn"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>` : ''}
    </div>
    <div class="post-body">
      <p class="post-text">${linkify(post.text)}</p>
    </div>
    ${post.image ? `<img src="${post.image}" alt="post image" class="post-image" />` : ''}
    <div class="post-actions">
      <button class="post-action-btn like-btn ${liked ? 'liked' : ''}" data-post="${post.id}">
        <i class="fa-${liked ? 'solid' : 'regular'} fa-heart"></i>
        <span class="like-count">${post.likes.length}</span>
      </button>
      <button class="post-action-btn comment-toggle-btn" data-post="${post.id}">
        <i class="fa-regular fa-comment"></i>
        <span class="comment-count">${post.comments.length}</span>
      </button>
      <span class="post-action-spacer"></span>
      <button class="post-action-btn share-btn" data-post="${post.id}" title="Copy link">
        <i class="fa-solid fa-share-nodes"></i>
      </button>
    </div>
    <div class="comments-section" style="display:none">
      <div class="comment-form">
        <img src="${me.avatar}" alt="me" class="comment-avatar" />
        <div class="comment-input-wrap">
          <input type="text" class="comment-input" placeholder="Write a comment…" maxlength="280" />
          <button class="comment-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
      </div>
      <div class="comments-list">
        ${post.comments.map(c => renderCommentHTML(c)).join('')}
      </div>
    </div>`;

  // — Avatar / name → profile
  card.querySelectorAll('[data-username]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.href = `profile.html?u=${el.dataset.username}`;
    });
  });

  // — Post image lightbox
  const postImg = card.querySelector('.post-image');
  if (postImg) {
    postImg.addEventListener('click', () => openLightbox(postImg.src));
  }

  // — Delete menu
  const menuBtn = card.querySelector('.post-menu-btn');
  const menuDrop = card.querySelector('.post-menu-dropdown');
  if (menuBtn) {
    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      menuDrop.classList.toggle('open');
    });
    document.addEventListener('click', () => menuDrop && menuDrop.classList.remove('open'));
  }
  const deleteBtn = card.querySelector('.delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (!confirm('Delete this post?')) return;
      DB.Posts.delete(post.id, me.id);
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity    = '0';
      card.style.transform  = 'scale(.96)';
      setTimeout(() => card.remove(), 300);
      showToast('Post deleted.', 'default');
    });
  }

  // — Like
  card.querySelector('.like-btn').addEventListener('click', function () {
    const result = DB.Posts.toggleLike(post.id, me.id);
    if (!result) return;
    this.classList.toggle('liked', result.liked);
    this.querySelector('i').className = result.liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    this.querySelector('.like-count').textContent = result.count;
  });

  // — Comments toggle
  card.querySelector('.comment-toggle-btn').addEventListener('click', function () {
    const section = card.querySelector('.comments-section');
    const open    = section.style.display !== 'none';
    section.style.display = open ? 'none' : 'block';
    this.classList.toggle('commented', !open);
    if (!open) card.querySelector('.comment-input').focus();
  });

  // — Send comment
  const sendComment = () => {
    const input   = card.querySelector('.comment-input');
    const text    = input.value.trim();
    if (!text) return;
    const comment = DB.Posts.addComment(post.id, me.id, text);
    if (!comment) return;
    input.value = '';
    const list = card.querySelector('.comments-list');
    list.insertAdjacentHTML('beforeend', renderCommentHTML(comment));
    // bind click on new comment name
    bindCommentClicks(list.lastElementChild);
    card.querySelector('.comment-count').textContent =
      parseInt(card.querySelector('.comment-count').textContent) + 1;
  };
  card.querySelector('.comment-send-btn').addEventListener('click', sendComment);
  card.querySelector('.comment-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); }
  });

  // bind existing comment name clicks
  card.querySelectorAll('.comment-bubble-name').forEach(el => {
    el.addEventListener('click', () => {
      window.location.href = `profile.html?u=${el.dataset.username}`;
    });
  });

  // — Share / copy
  card.querySelector('.share-btn').addEventListener('click', () => {
    const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}index.html#${post.id}`;
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success'))
      .catch(() => showToast('Could not copy link.', 'error'));
  });

  if (prepend) {
    container.insertAdjacentElement('afterbegin', card);
  } else {
    container.appendChild(card);
  }

  return card;
}

function renderCommentHTML(c) {
  const author = DB.Users.find(c.authorId);
  if (!author) return '';
  return `
    <div class="comment-item">
      <img src="${author.avatar}" alt="${author.displayName}" />
      <div class="comment-bubble">
        <span class="comment-bubble-name" data-username="${author.username}"
              style="cursor:pointer">${author.displayName}</span>
        <p class="comment-bubble-text">${linkify(c.text)}</p>
        <span class="comment-bubble-time">${timeAgo(c.createdAt)}</span>
      </div>
    </div>`;
}

function bindCommentClicks(el) {
  if (!el) return;
  el.querySelectorAll('.comment-bubble-name').forEach(n => {
    n.addEventListener('click', () => {
      window.location.href = `profile.html?u=${n.dataset.username}`;
    });
  });
}

/* ══════════════════════════════════════════════
   LIGHTBOX
══════════════════════════════════════════════ */
function openLightbox(src) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<img src="${src}" alt="full size image" />`;
  box.addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}

/* ══════════════════════════════════════════════
   SIDEBAR — profile mini & suggestions
   (only on index.html)
══════════════════════════════════════════════ */
if (document.getElementById('sideDisplayName')) {
  document.getElementById('sideAvatar').src       = me.avatar;
  document.getElementById('sideDisplayName').textContent = me.displayName;
  document.getElementById('sideHandle').textContent      = '@' + me.username;

  const sugList = document.getElementById('suggestionsList');
  if (sugList) {
    const sugs = DB.Users.suggestions(me.id, 4);
    sugList.innerHTML = '';
    sugs.forEach(u => {
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="${u.avatar}" alt="${u.displayName}" style="cursor:pointer" />
        <div class="sug-info">
          <div class="sug-name">${u.displayName}</div>
          <div class="sug-handle">@${u.username}</div>
        </div>
        <button class="btn btn-outline btn-sm sug-follow-btn" data-uid="${u.id}">Follow</button>`;
      li.querySelector('img').addEventListener('click', () => {
        window.location.href = `profile.html?u=${u.username}`;
      });
      li.querySelector('.sug-follow-btn').addEventListener('click', function () {
        DB.Users.follow(me.id, u.id);
        this.textContent  = 'Following';
        this.disabled     = true;
        this.classList.replace('btn-outline', 'btn-primary');
        showToast(`Following ${u.displayName}`, 'success');
        updateNotifBadge();
      });
      sugList.appendChild(li);
    });
    document.getElementById('suggestionsCard').style.display = sugs.length ? 'block' : 'none';
  }
}

/* ══════════════════════════════════════════════
   TRENDING TAGS (sidebar, index.html)
══════════════════════════════════════════════ */
if (document.getElementById('trendingList')) {
  const tags = DB.Posts.trendingTags(8);
  const list = document.getElementById('trendingList');
  list.innerHTML = '';
  tags.forEach(({ tag, count }) => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="trend-tag">${tag}</div><div class="trend-count">${count} post${count !== 1 ? 's' : ''}</div>`;
    li.addEventListener('click', () => {
      window.location.href = `explore.html?tag=${encodeURIComponent(tag.slice(1))}`;
    });
    list.appendChild(li);
  });
}

