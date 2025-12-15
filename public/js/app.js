/**
 * ATProtocol OAuth Starter Kit - Frontend Application
 */

// DOM Elements
const loading = document.getElementById('loading');
const loginSection = document.getElementById('loginSection');
const appSection = document.getElementById('appSection');
const loginForm = document.getElementById('loginForm');
const feedContainer = document.getElementById('feedContainer');
const feedLoading = document.getElementById('feedLoading');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const refreshFeedBtn = document.getElementById('refreshFeedBtn');

// State
let feedCursor = null;

/**
 * Check user session and initialize app
 */
async function checkSession() {
  try {
    // Fetch CSRF token first
    const csrfRes = await fetch('/api/csrf');
    const csrfData = await csrfRes.json();
    window.csrfToken = csrfData.token;

    const res = await fetch('/api/me');
    const data = await res.json();

    loading.classList.add('hidden');
    if (data.loggedIn) {
      showApp(data);
    } else {
      loginSection.classList.remove('hidden');
    }
  } catch (e) {
    console.error(e);
    loading.textContent = 'Error loading session.';
  }
}

/**
 * Show authenticated app interface
 */
function showApp(user) {
  document.getElementById('displayName').textContent = user.displayName || user.handle;
  document.getElementById('userHandle').textContent = '@' + user.handle;
  if (user.avatar) {
    document.getElementById('avatar').src = user.avatar;
  }

  loginSection.classList.add('hidden');
  appSection.classList.remove('hidden');

  // Load feed
  fetchFeed();
}

/**
 * Fetch timeline feed
 */
async function fetchFeed(cursor = null) {
  try {
    if (!cursor) {
      feedLoading.classList.remove('hidden');
      feedContainer.innerHTML = '';
      loadMoreBtn.classList.add('hidden');
    }

    const url = cursor ? `/api/feed?cursor=${encodeURIComponent(cursor)}` : '/api/feed';
    const res = await fetch(url);
    const data = await res.json();

    feedLoading.classList.add('hidden');

    if (data.error) {
      feedContainer.innerHTML = '<div class="empty-state">Failed to load feed</div>';
      return;
    }

    if (!cursor && data.posts.length === 0) {
      feedContainer.innerHTML = '<div class="empty-state">No posts yet. Follow some people to see their posts here!</div>';
      return;
    }

    renderPosts(data.posts);
    feedCursor = data.cursor;

    if (data.cursor) {
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  } catch (e) {
    console.error('Feed error:', e);
    feedLoading.classList.add('hidden');
    feedContainer.innerHTML = '<div class="empty-state">Failed to load feed</div>';
  }
}

/**
 * Render posts to the feed container
 */
function renderPosts(posts) {
  posts.forEach(post => {
    const postEl = document.createElement('div');
    postEl.className = 'post';
    postEl.innerHTML = `
      <div class="post-author">
        <img src="${escapeHtml(post.author.avatar || '')}" alt="" onerror="this.style.display='none'">
        <div class="post-author-info">
          <div class="post-author-name">${escapeHtml(post.author.displayName)}</div>
          <div class="post-author-handle">@${escapeHtml(post.author.handle)}</div>
        </div>
      </div>
      <div class="post-content">${escapeHtml(post.text)}</div>
      <div class="post-meta">
        <span>${post.replyCount} replies</span>
        <span>${post.repostCount} reposts</span>
        <span>${post.likeCount} likes</span>
        <span class="post-time">${formatTime(post.createdAt)}</span>
      </div>
    `;
    feedContainer.appendChild(postEl);
  });
}

/**
 * Format timestamp to relative time
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create a new post
 */
async function createPost() {
  const textInput = document.getElementById('postText');
  const btn = document.getElementById('postBtn');
  const status = document.getElementById('postStatus');
  const text = textInput.value.trim();

  if (!text) return;

  btn.disabled = true;
  status.textContent = 'Posting...';
  status.className = '';

  try {
    const res = await fetch('/api/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.csrfToken
      },
      body: JSON.stringify({ text })
    });
    const data = await res.json();

    if (data.success) {
      status.textContent = 'Posted!';
      status.className = 'success';
      textInput.value = '';
      // Refresh feed to show new post
      fetchFeed();
      setTimeout(() => {
        status.textContent = '';
      }, 3000);
    } else {
      status.textContent = 'Error: ' + (data.error || 'Unknown error');
      status.className = 'error';
    }
  } catch (e) {
    status.textContent = 'Network error';
    status.className = 'error';
  } finally {
    btn.disabled = false;
  }
}

/**
 * Logout user
 */
async function logout() {
  await fetch('/logout', {
    method: 'POST',
    headers: {
      'x-csrf-token': window.csrfToken
    }
  });
  window.location.reload();
}

// Event Listeners
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const handle = document.getElementById('handle').value.trim();
  window.location.href = `/login?handle=${encodeURIComponent(handle)}`;
});

document.getElementById('postBtn').addEventListener('click', createPost);
document.getElementById('logoutBtn').addEventListener('click', logout);
loadMoreBtn.addEventListener('click', () => fetchFeed(feedCursor));
refreshFeedBtn.addEventListener('click', () => fetchFeed());

// Initialize
checkSession();
