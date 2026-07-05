/* =============================================
   explore.js — Explore page logic
   ============================================= */

const exploreFeed      = document.getElementById('exploreFeed');
const exploreFeedEmpty = document.getElementById('exploreFeedEmpty');
const exploreUsers     = document.getElementById('exploreUsers');
const exploreSearchEl  = document.getElementById('exploreSearch');

/* ── Render people list ── */
function renderPeopleList(users) {
  exploreUsers.innerHTML = '';
  if (users.length === 0) {
    exploreUsers.innerHTML = '<li style="color:var(--text-muted);font-size:.88rem;padding:8px 0;">No users found.</li>';
    return;
  }
  users.forEach(u => {
    const li = document.createElement('li');
    const iFollow = (DB.Users.find(me.id)).following.includes(u.id);
    li.innerHTML = `
      <img src="${u.avatar}" alt="${u.displayName}" />
      <div class="eu-info">
        <div class="eu-name">${u.displayName}</div>
        <div class="eu-handle">@${u.username}</div>
      </div>
      ${u.id !== me.id ? `
        <button class="btn btn-sm ${iFollow ? 'btn-outline' : 'btn-primary'} follow-toggle"
                data-uid="${u.id}">
          ${iFollow ? 'Following' : 'Follow'}
        </button>` : '<span style="font-size:.8rem;color:var(--text-muted)">You</span>'}`;

    li.querySelector('img').addEventListener('click', () => {
      window.location.href = `profile.html?u=${u.username}`;
    });

    const followBtn = li.querySelector('.follow-toggle');
    if (followBtn) {
      followBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid     = followBtn.dataset.uid;
        const meData  = DB.Users.find(me.id);
        const already = meData.following.includes(uid);
        if (already) {
          DB.Users.unfollow(me.id, uid);
          followBtn.textContent = 'Follow';
          followBtn.classList.replace('btn-outline', 'btn-primary');
          showToast('Unfollowed');
        } else {
          DB.Users.follow(me.id, uid);
          followBtn.textContent = 'Following';
          followBtn.classList.replace('btn-primary', 'btn-outline');
          showToast(`Following ${u.displayName}`, 'success');
        }
        updateNotifBadge();
      });
    }
    exploreUsers.appendChild(li);
  });
}

/* ── Render explore posts ── */
function renderExplorePosts(posts) {
  exploreFeed.innerHTML = '';
  if (posts.length === 0) {
    exploreFeedEmpty.style.display = 'block';
    return;
  }
  exploreFeedEmpty.style.display = 'none';
  posts.forEach(p => renderPost(p, exploreFeed));
}

/* ── Search / filter ── */
function runSearch(query) {
  const q = (query || '').trim().toLowerCase();

  const allUsers = DB.Users.all();
  const filteredUsers = q
    ? allUsers.filter(u => u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q))
    : allUsers;

  const filteredPosts = q
    ? DB.Posts.search(q)
    : DB.Posts.trending(12);

  renderPeopleList(filteredUsers);
  renderExplorePosts(filteredPosts);
}

/* ── Handle ?tag= URL param ── */
const urlParams  = new URLSearchParams(location.search);
const tagParam   = urlParams.get('tag');
if (tagParam) {
  exploreSearchEl.value = '#' + tagParam;
  runSearch('#' + tagParam);
} else {
  runSearch('');
}

/* ── Live search ── */
let debounceTimer;
exploreSearchEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch(exploreSearchEl.value), 250);
});
