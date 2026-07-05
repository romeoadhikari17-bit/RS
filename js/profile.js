/* =============================================
   profile.js — Profile page logic
   ============================================= */

// Determine which user's profile to show
const params        = new URLSearchParams(location.search);
const targetUsername = params.get('u') || me.username;
let   profileUser   = DB.Users.findByUsername(targetUsername);

if (!profileUser) {
  showToast('User not found. Redirecting…', 'error');
  setTimeout(() => window.location.href = 'index.html', 1500);
  throw new Error('User not found');
}

const isOwnProfile = profileUser.id === me.id;

/* ── Render header ── */
function renderProfileHeader() {
  profileUser = DB.Users.find(profileUser.id); // fresh data

  document.title = `SocialSpark — ${profileUser.displayName}`;

  // Cover
  const cover = document.getElementById('profileCover');
  if (profileUser.cover) {
    cover.style.backgroundImage = `url(${profileUser.cover})`;
    cover.style.backgroundSize  = 'cover';
    cover.style.backgroundPosition = 'center';
  }

  // Avatar
  document.getElementById('profileAvatar').src       = profileUser.avatar;
  document.getElementById('profileDisplayName').textContent = profileUser.displayName;
  document.getElementById('profileHandleText').textContent  = '@' + profileUser.username;
  document.getElementById('profileBio').textContent         = profileUser.bio || '';

  // Stats
  document.getElementById('statPosts').textContent    = DB.Posts.byUser(profileUser.id).length;
  document.getElementById('statFollowers').textContent = profileUser.followers.length;
  document.getElementById('statFollowing').textContent = profileUser.following.length;

  // Actions
  const actionsEl = document.getElementById('profileActions');
  actionsEl.innerHTML = '';

  if (isOwnProfile) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline';
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Profile';
    editBtn.addEventListener('click', openEditModal);
    actionsEl.appendChild(editBtn);
  } else {
    // Always re-read follow state at click time, not at render time
    const followBtn = document.createElement('button');
    const refreshFollowBtn = () => {
      const fresh = DB.Users.find(me.id);
      const following = fresh.following.includes(profileUser.id);
      followBtn.className = following ? 'btn btn-outline' : 'btn btn-primary';
      followBtn.innerHTML = following
        ? '<i class="fa-solid fa-user-minus"></i> Unfollow'
        : '<i class="fa-solid fa-user-plus"></i> Follow';
    };
    refreshFollowBtn();
    followBtn.addEventListener('click', () => {
      const fresh = DB.Users.find(me.id);
      const currently = fresh.following.includes(profileUser.id);
      if (currently) {
        DB.Users.unfollow(me.id, profileUser.id);
        showToast(`Unfollowed ${profileUser.displayName}`);
      } else {
        DB.Users.follow(me.id, profileUser.id);
        showToast(`Following ${profileUser.displayName}`, 'success');
      }
      renderProfileHeader();
    });
    actionsEl.appendChild(followBtn);
  }
}

/* ── Followers / Following modals ── */
function openFollowModal(type) {
  const title = document.getElementById('followModalTitle');
  const list  = document.getElementById('followModalList');
  profileUser = DB.Users.find(profileUser.id);

  title.textContent = type === 'followers' ? 'Followers' : 'Following';
  const ids = type === 'followers' ? profileUser.followers : profileUser.following;
  list.innerHTML = '';

  if (ids.length === 0) {
    list.innerHTML = '<li style="padding:20px;text-align:center;color:var(--text-muted)">None yet.</li>';
  } else {
    ids.forEach(uid => {
      const u = DB.Users.find(uid);
      if (!u) return;
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="${u.avatar}" alt="${u.displayName}" />
        <div>
          <div class="fl-name">${u.displayName}</div>
          <div class="fl-handle">@${u.username}</div>
        </div>`;
      li.addEventListener('click', () => {
        window.location.href = `profile.html?u=${u.username}`;
      });
      list.appendChild(li);
    });
  }
  document.getElementById('followModal').style.display = 'flex';
}

document.getElementById('statFollowersWrap').addEventListener('click', () => openFollowModal('followers'));
document.getElementById('statFollowingWrap').addEventListener('click', () => openFollowModal('following'));
document.getElementById('closeFollowModal').addEventListener('click', () => {
  document.getElementById('followModal').style.display = 'none';
});
document.getElementById('followModal').addEventListener('click', e => {
  if (e.target === document.getElementById('followModal'))
    document.getElementById('followModal').style.display = 'none';
});

/* ── Edit Profile Modal ── */
function openEditModal() {
  const fresh = DB.Users.find(me.id);
  document.getElementById('editDisplayName').value = fresh.displayName;
  document.getElementById('editBio').value         = fresh.bio || '';
  document.getElementById('editAvatarUrl').value   = (fresh.avatar.startsWith('data:') ? '' : fresh.avatar);
  document.getElementById('editCoverUrl').value    = fresh.cover || '';
  document.getElementById('editModal').style.display = 'flex';
}

document.getElementById('closeEditModal').addEventListener('click', () => {
  document.getElementById('editModal').style.display = 'none';
});
document.getElementById('editModal').addEventListener('click', e => {
  if (e.target === document.getElementById('editModal'))
    document.getElementById('editModal').style.display = 'none';
});

document.getElementById('editProfileForm').addEventListener('submit', e => {
  e.preventDefault();
  const displayName = document.getElementById('editDisplayName').value.trim();
  const bio         = document.getElementById('editBio').value.trim();
  const avatarUrl   = document.getElementById('editAvatarUrl').value.trim();
  const coverUrl    = document.getElementById('editCoverUrl').value.trim();
  const errEl       = document.getElementById('editError');
  errEl.textContent = '';

  if (!displayName) { errEl.textContent = 'Display name is required.'; return; }

  const changes = { displayName, bio };
  if (avatarUrl) changes.avatar = avatarUrl;
  if (coverUrl)  changes.cover  = coverUrl;

  DB.Users.update(me.id, changes);
  profileUser = DB.Users.find(me.id);

  // Update nav avatar
  document.getElementById('navAvatar').src = profileUser.avatar;

  document.getElementById('editModal').style.display = 'none';
  renderProfileHeader();
  loadProfileFeed(activeProfileTab);
  showToast('Profile updated!', 'success');
});

/* ── Profile Feed Tabs ── */
let activeProfileTab = 'posts';
document.querySelectorAll('.profile-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeProfileTab = tab.dataset.tab;
    loadProfileFeed(activeProfileTab);
  });
});

function loadProfileFeed(tab) {
  const container = document.getElementById('profileFeed');
  const empty     = document.getElementById('profileFeedEmpty');
  container.innerHTML = '';

  const posts = tab === 'liked'
    ? DB.Posts.likedBy(profileUser.id)
    : DB.Posts.byUser(profileUser.id);

  if (posts.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  posts.forEach(p => renderPost(p, container));
}

/* ── Init ── */
renderProfileHeader();
loadProfileFeed('posts');

// Also wire notif badge (shared app.js already sets up the button logic)
