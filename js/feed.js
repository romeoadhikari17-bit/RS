/* =============================================
   feed.js — Home feed logic (index.html)
   ============================================= */

const feedContainer = document.getElementById('feedContainer');
const feedEmpty     = document.getElementById('feedEmpty');
const postBtn       = document.getElementById('postBtn');
const postContent   = document.getElementById('postContent');
const postImageUrl  = document.getElementById('postImageUrl');
const charCount     = document.getElementById('charCount');
const composeAvatar = document.getElementById('composeAvatar');

// Set compose avatar
if (composeAvatar) composeAvatar.src = me.avatar;

// Char counter
if (postContent) {
  postContent.addEventListener('input', () => {
    const len = postContent.value.length;
    charCount.textContent = len;
    charCount.parentElement.className = 'compose-chars' +
      (len > 450 ? (len > 490 ? ' danger' : ' warn') : '');
  });
}

/* ── Feed Tabs ── */
let activeTab = 'for-you';
document.querySelectorAll('.feed-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    loadFeed();
  });
});

/* ── Load Feed ── */
function loadFeed() {
  feedContainer.innerHTML = '';
  let posts;

  if (activeTab === 'following') {
    // Show only posts from people the current user follows + their own posts
    const myData = DB.Users.find(me.id);
    const ids    = [me.id, ...(myData ? myData.following : [])];
    posts        = DB.Posts.all().filter(p => ids.includes(p.authorId));
  } else {
    // "For You" — show everything
    posts = DB.Posts.all();
  }

  if (posts.length === 0) {
    feedEmpty.style.display = 'block';
    return;
  }
  feedEmpty.style.display = 'none';
  posts.forEach(p => renderPost(p, feedContainer));
}

/* ── Create Post ── */
if (postBtn) {
  postBtn.addEventListener('click', () => {
    const text  = postContent.value.trim();
    const image = postImageUrl.value.trim();
    if (!text) {
      showToast('Write something first!', 'error');
      postContent.focus();
      return;
    }
    const result = DB.Posts.create(me.id, text, image);
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    postContent.value  = '';
    postImageUrl.value = '';
    charCount.textContent = '0';
    charCount.parentElement.className = 'compose-chars';

    // Animate the new card in
    const card = renderPost(result.post, feedContainer, { prepend: true });
    if (card) {
      card.style.opacity   = '0';
      card.style.transform = 'translateY(-12px)';
      card.style.transition = 'opacity .3s ease, transform .3s ease';
      requestAnimationFrame(() => {
        card.style.opacity   = '1';
        card.style.transform = 'translateY(0)';
      });
    }
    feedEmpty.style.display = 'none';
    showToast('Sparked! ⚡', 'success');
  });
}

// Enter key in compose (Ctrl/Cmd+Enter)
if (postContent) {
  postContent.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      postBtn.click();
    }
  });
}

// Initial load
loadFeed();
