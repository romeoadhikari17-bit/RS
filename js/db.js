/* =============================================
   db.js — localStorage "backend"
   All data lives in localStorage under keys:
     ss_users, ss_posts, ss_notifications
   ============================================= */

const DB = (() => {

  // ── helpers ──────────────────────────────────
  const read  = key => JSON.parse(localStorage.getItem(key) || '[]');
  const write = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ── default avatar (SVG data-URI) ────────────
  const defaultAvatar = username => {
    const colors = ['#7c3aed','#4f46e5','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'];
    const color  = colors[username.charCodeAt(0) % colors.length];
    const letter = (username[0] || '?').toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="${color}"/>
      <text x="50" y="65" font-size="48" font-family="sans-serif"
        font-weight="bold" fill="white" text-anchor="middle">${letter}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  // ── seed demo users if DB is empty ───────────
  const seed = () => {
    if (read('ss_users').length) return;

    const alice = {
      id: uid(), username: 'alice', displayName: 'Alice Wonder',
      email: 'alice@example.com', password: 'password',
      bio: 'Curiosity-driven explorer. Coffee & code. ☕',
      avatar: defaultAvatar('alice'), cover: '',
      followers: [], following: [], createdAt: Date.now() - 86400000 * 10
    };
    const bob = {
      id: uid(), username: 'bob', displayName: 'Bob Builder',
      email: 'bob@example.com', password: 'password',
      bio: 'Building things one commit at a time. 🔧',
      avatar: defaultAvatar('bob'), cover: '',
      followers: [alice.id], following: [alice.id], createdAt: Date.now() - 86400000 * 7
    };
    alice.followers.push(bob.id);
    alice.following.push(bob.id);

    write('ss_users', [alice, bob]);

    const posts = [
      {
        id: uid(), authorId: alice.id,
        text: "Just joined SocialSpark! 🎉 Excited to connect with everyone here. #hello #firstpost",
        image: '', likes: [bob.id], comments: [], createdAt: Date.now() - 86400000 * 9
      },
      {
        id: uid(), authorId: bob.id,
        text: "Beautiful morning for some coding! ☀️ Working on a new open-source project. Stay tuned! #coding #opensource",
        image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80',
        likes: [alice.id], comments: [
          { id: uid(), authorId: alice.id, text: "Can't wait to see it! 🚀", createdAt: Date.now() - 86400000 * 6 }
        ],
        createdAt: Date.now() - 86400000 * 6
      },
      {
        id: uid(), authorId: alice.id,
        text: "Pro tip: take breaks while coding. Your future self will thank you. 💡 #devtips #productivity",
        image: '', likes: [], comments: [], createdAt: Date.now() - 86400000 * 3
      },
      {
        id: uid(), authorId: bob.id,
        text: "Shipped the first version! 🎊 Check out the repo. #milestone #shipping",
        image: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&q=80',
        likes: [alice.id], comments: [], createdAt: Date.now() - 86400000 * 1
      }
    ];
    write('ss_posts', posts);
    write('ss_notifications', []);
  };

  seed();

  // ══════════════════════════════════════════════
  // USERS
  // ══════════════════════════════════════════════
  const Users = {
    all: () => read('ss_users'),

    find: id => read('ss_users').find(u => u.id === id) || null,

    findByUsername: username =>
      read('ss_users').find(u => u.username.toLowerCase() === username.toLowerCase()) || null,

    create: ({ username, displayName, email, password, bio }) => {
      const users = read('ss_users');
      if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
        return { error: 'Username already taken.' };
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
        return { error: 'Email already registered.' };
      if (!/^[a-zA-Z0-9_]+$/.test(username))
        return { error: 'Username can only contain letters, numbers and underscores.' };
      if (password.length < 6)
        return { error: 'Password must be at least 6 characters.' };

      const user = {
        id: uid(), username, displayName, email, password,
        bio: bio || '', avatar: defaultAvatar(username), cover: '',
        followers: [], following: [], createdAt: Date.now()
      };
      users.push(user);
      write('ss_users', users);
      return { user };
    },

    update: (id, changes) => {
      const users = read('ss_users');
      const idx   = users.findIndex(u => u.id === id);
      if (idx === -1) return null;
      users[idx] = { ...users[idx], ...changes };
      write('ss_users', users);
      return users[idx];
    },

    authenticate: (username, password) => {
      const u = Users.findByUsername(username);
      if (!u) return { error: 'User not found.' };
      if (u.password !== password) return { error: 'Incorrect password.' };
      return { user: u };
    },

    follow: (currentId, targetId) => {
      const users = read('ss_users');
      const cur   = users.find(u => u.id === currentId);
      const tgt   = users.find(u => u.id === targetId);
      if (!cur || !tgt) return;
      if (!cur.following.includes(targetId)) cur.following.push(targetId);
      if (!tgt.followers.includes(currentId)) tgt.followers.push(currentId);
      write('ss_users', users);
      Notifications.add({
        userId: targetId, actorId: currentId,
        type: 'follow', text: `started following you`
      });
    },

    unfollow: (currentId, targetId) => {
      const users = read('ss_users');
      const cur   = users.find(u => u.id === currentId);
      const tgt   = users.find(u => u.id === targetId);
      if (!cur || !tgt) return;
      cur.following = cur.following.filter(id => id !== targetId);
      tgt.followers = tgt.followers.filter(id => id !== currentId);
      write('ss_users', users);
    },

    suggestions: (currentId, limit = 5) => {
      const me = Users.find(currentId);
      if (!me) return [];
      return Users.all()
        .filter(u => u.id !== currentId && !me.following.includes(u.id))
        .slice(0, limit);
    }
  };

  // ══════════════════════════════════════════════
  // POSTS
  // ══════════════════════════════════════════════
  const Posts = {
    all: () => read('ss_posts').sort((a, b) => b.createdAt - a.createdAt),

    find: id => read('ss_posts').find(p => p.id === id) || null,

    byUser: userId =>
      Posts.all().filter(p => p.authorId === userId),

    likedBy: userId =>
      Posts.all().filter(p => p.likes.includes(userId)),

    feed: (userId) => {
      const me = Users.find(userId);
      if (!me) return [];
      const ids = [userId, ...me.following];
      return Posts.all().filter(p => ids.includes(p.authorId));
    },

    create: (authorId, text, image = '') => {
      if (!text.trim()) return { error: 'Post cannot be empty.' };
      if (text.length > 500) return { error: 'Post too long.' };
      const posts = read('ss_posts');
      const post  = { id: uid(), authorId, text: text.trim(), image, likes: [], comments: [], createdAt: Date.now() };
      posts.unshift(post);
      write('ss_posts', posts);
      return { post };
    },

    delete: (postId, userId) => {
      const posts = read('ss_posts');
      const post  = posts.find(p => p.id === postId);
      if (!post || post.authorId !== userId) return false;
      write('ss_posts', posts.filter(p => p.id !== postId));
      return true;
    },

    toggleLike: (postId, userId) => {
      const posts = read('ss_posts');
      const post  = posts.find(p => p.id === postId);
      if (!post) return null;
      const liked = post.likes.includes(userId);
      if (liked) {
        post.likes = post.likes.filter(id => id !== userId);
      } else {
        post.likes.push(userId);
        if (post.authorId !== userId) {
          Notifications.add({
            userId: post.authorId, actorId: userId,
            type: 'like', postId, text: 'liked your post'
          });
        }
      }
      write('ss_posts', posts);
      return { liked: !liked, count: post.likes.length };
    },

    addComment: (postId, authorId, text) => {
      if (!text.trim()) return null;
      const posts   = read('ss_posts');
      const post    = posts.find(p => p.id === postId);
      if (!post) return null;
      const comment = { id: uid(), authorId, text: text.trim(), createdAt: Date.now() };
      post.comments.push(comment);
      write('ss_posts', posts);
      if (post.authorId !== authorId) {
        Notifications.add({
          userId: post.authorId, actorId: authorId,
          type: 'comment', postId, text: 'commented on your post'
        });
      }
      return comment;
    },

    trending: (limit = 6) =>
      Posts.all()
        .sort((a, b) => (b.likes.length + b.comments.length) - (a.likes.length + a.comments.length))
        .slice(0, limit),

    trendingTags: (limit = 8) => {
      const tagMap = {};
      Posts.all().forEach(p => {
        const tags = p.text.match(/#\w+/g) || [];
        tags.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
      });
      return Object.entries(tagMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tag, count]) => ({ tag, count }));
    },

    search: query => {
      const q = query.toLowerCase().trim();
      if (!q) return Posts.all();
      return Posts.all().filter(p =>
        p.text.toLowerCase().includes(q)
      );
    }
  };

  // ══════════════════════════════════════════════
  // NOTIFICATIONS
  // ══════════════════════════════════════════════
  const Notifications = {
    forUser: userId =>
      read('ss_notifications')
        .filter(n => n.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt),

    add: ({ userId, actorId, type, postId, text }) => {
      const notifs = read('ss_notifications');
      notifs.unshift({ id: uid(), userId, actorId, type, postId: postId || null, text, read: false, createdAt: Date.now() });
      write('ss_notifications', notifs.slice(0, 100)); // keep last 100
    },

    unreadCount: userId =>
      read('ss_notifications').filter(n => n.userId === userId && !n.read).length,

    markAllRead: userId => {
      const notifs = read('ss_notifications').map(n =>
        n.userId === userId ? { ...n, read: true } : n
      );
      write('ss_notifications', notifs);
    },

    clearAll: userId => {
      write('ss_notifications', read('ss_notifications').filter(n => n.userId !== userId));
    }
  };

  // ── public API ────────────────────────────────
  return { Users, Posts, Notifications, defaultAvatar };
})();
