/* ─── Threads Page — Internal Team Threads / Chat ─── */
const ThreadsPage = (() => {

  let _activeChannel = null;
  let _activeThread  = null;
  const REACTIONS = ['👍','🔥','❤️','😂','👀','🎉','💯','👏'];

  /* ── Helpers ── */
  function _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _timeAgo(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }
  function _avatar(name) {
    const initials = (name || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const colors = ['#2F6BFF','#E8A640','#34C759','#FF6B6B','#A78BFA','#F472B6','#06B6D4','#10B981'];
    const idx = (name||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0) % colors.length;
    return `<div style="width:32px;height:32px;border-radius:50%;background:${colors[idx]};display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff;flex-shrink:0">${initials}</div>`;
  }

  /* ── Channel List (Home) ── */
  function _renderChannels() {
    const channels = Store.getThreadChannels();
    const threads = Store.getThreads();
    const unread = {};
    channels.forEach(ch => { unread[ch.id] = threads.filter(t => t.channelId === ch.id).length; });

    return `
      <div class="page active" id="page-threads">
        <p class="page-subtitle" style="margin-bottom:2px">Team Communication</p>
        <h1 class="page-title" style="margin-bottom:16px">Channels</h1>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${channels.map(ch => `
            <button onclick="ThreadsPage.openChannel('${ch.id}')"
              style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;cursor:pointer;text-align:left;width:100%;transition:transform 0.15s">
              <span style="font-size:1.3rem">${ch.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:0.85rem;font-weight:600;color:var(--text)">${_esc(ch.name)}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${_esc(ch.description||'')}</div>
              </div>
              <span style="font-size:0.68rem;padding:2px 8px;border-radius:10px;background:var(--primary-bg);color:var(--primary);font-weight:600">${unread[ch.id] || 0}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ── Thread List for a Channel ── */
  function _renderThreadList(channelId) {
    const channel = Store.getThreadChannels().find(c => c.id === channelId);
    const threads = Store.getThreads().filter(t => t.channelId === channelId);
    const messages = Store.getThreadMessages();

    return `
      <div class="page active" id="page-threads">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <button onclick="ThreadsPage.backToChannels()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;padding:4px;color:var(--text)">←</button>
          <span style="font-size:1.3rem">${channel ? channel.icon : '💬'}</span>
          <h1 class="page-title" style="margin:0">${_esc(channel ? channel.name : 'Channel')}</h1>
        </div>

        <button onclick="ThreadsPage.newThread('${channelId}')"
          style="width:100%;padding:12px 16px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:0.8rem;font-weight:600;cursor:pointer;margin-bottom:16px;transition:opacity 0.15s">
          + New Thread
        </button>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${threads.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.82rem">No threads yet. Start one!</div>' :
            threads.map(t => {
              const msgCount = messages.filter(m => m.threadId === t.id).length;
              const lastMsg = messages.filter(m => m.threadId === t.id).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))[0];
              const pinStyle = t.pinned ? 'border-left:3px solid var(--primary);' : '';
              return `
                <button onclick="ThreadsPage.openThread('${channelId}','${t.id}')"
                  style="display:flex;flex-direction:column;gap:6px;padding:14px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;cursor:pointer;text-align:left;width:100%;${pinStyle}transition:transform 0.15s">
                  <div style="display:flex;align-items:center;gap:8px">
                    ${_avatar(t.author)}
                    <div style="flex:1;min-width:0">
                      <div style="font-size:0.82rem;font-weight:600;color:var(--text)">${_esc(t.title)}</div>
                      <div style="font-size:0.68rem;color:var(--text-muted)">${_esc(t.author)} · ${_timeAgo(t.createdAt)}${t.pinned ? ' · 📌 Pinned' : ''}</div>
                    </div>
                    <span style="font-size:0.65rem;color:var(--text-muted)">${msgCount} ${msgCount===1?'reply':'replies'}</span>
                  </div>
                  ${t.preview ? `<div style="font-size:0.75rem;color:var(--text-muted);line-height:1.4;margin-top:2px">${_esc(t.preview)}</div>` : ''}
                  ${t.linkedEventId ? `<div style="font-size:0.65rem;color:var(--primary);margin-top:2px">📋 Linked to event</div>` : ''}
                  ${t.linkedTaskId ? `<div style="font-size:0.65rem;color:var(--primary);margin-top:2px">✅ Linked to task</div>` : ''}
                </button>
              `;
            }).join('')}
        </div>
      </div>
    `;
  }

  /* ── Thread Detail (Messages) ── */
  function _renderThreadDetail(channelId, threadId) {
    const channel = Store.getThreadChannels().find(c => c.id === channelId);
    const thread = Store.getThreads().find(t => t.id === threadId);
    if (!thread) return _renderThreadList(channelId);

    const messages = Store.getThreadMessages().filter(m => m.threadId === threadId)
      .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));

    return `
      <div class="page active" id="page-threads">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <button onclick="ThreadsPage.openChannel('${channelId}')" style="background:none;border:none;font-size:1.2rem;cursor:pointer;padding:4px;color:var(--text)">←</button>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.9rem;font-weight:700;color:var(--text)">${_esc(thread.title)}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">${channel ? channel.icon + ' ' + channel.name : ''} · ${_esc(thread.author)}</div>
          </div>
        </div>

        ${thread.linkedEventId ? `<div class="card" style="padding:10px 14px;margin-bottom:12px;font-size:0.72rem;color:var(--primary);background:var(--primary-bg);border:1px solid var(--primary);border-radius:10px">📋 Linked Event: ${_esc(thread.linkedEventName || thread.linkedEventId)}</div>` : ''}
        ${thread.linkedTaskId ? `<div class="card" style="padding:10px 14px;margin-bottom:12px;font-size:0.72rem;color:var(--success);background:var(--success-bg,rgba(52,199,89,0.1));border:1px solid var(--success);border-radius:10px">✅ Linked Task: ${_esc(thread.linkedTaskName || thread.linkedTaskId)}</div>` : ''}

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${messages.map(m => `
            <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)" id="msg-${m.id}">
              ${_avatar(m.author)}
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="font-size:0.78rem;font-weight:600;color:var(--text)">${_esc(m.author)}</span>
                  <span style="font-size:0.62rem;color:var(--text-muted)">${_timeAgo(m.createdAt)}</span>
                </div>
                <div style="font-size:0.8rem;color:var(--text);line-height:1.5">${_esc(m.text)}</div>
                ${m.reactions && Object.keys(m.reactions).length > 0 ? `
                  <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
                    ${Object.entries(m.reactions).map(([emoji,users]) => `
                      <button onclick="ThreadsPage.toggleReaction('${m.id}','${emoji}')"
                        style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:12px;border:1px solid var(--border);background:${users.includes('You')?'var(--primary-bg)':'var(--card-bg)'};cursor:pointer;font-size:0.72rem;transition:all 0.15s">
                        ${emoji} <span style="font-size:0.65rem;color:var(--text-muted)">${users.length}</span>
                      </button>
                    `).join('')}
                    <button onclick="ThreadsPage.showReactionPicker('${m.id}')"
                      style="padding:2px 8px;border-radius:12px;border:1px solid var(--border);background:var(--card-bg);cursor:pointer;font-size:0.72rem">+</button>
                  </div>
                ` : `
                  <div style="margin-top:4px">
                    <button onclick="ThreadsPage.showReactionPicker('${m.id}')"
                      style="padding:2px 8px;border-radius:12px;border:1px solid var(--border);background:var(--card-bg);cursor:pointer;font-size:0.68rem;color:var(--text-muted)">☺ React</button>
                  </div>
                `}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Reaction Picker (hidden) -->
        <div id="reaction-picker" style="display:none;position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:8px 12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:100;display:none">
          <div style="display:flex;gap:6px">
            ${REACTIONS.map(r => `<button onclick="ThreadsPage.addReaction('${r}')" style="font-size:1.3rem;padding:4px;border:none;background:none;cursor:pointer;transition:transform 0.15s" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${r}</button>`).join('')}
          </div>
        </div>

        <!-- Compose -->
        <div style="position:sticky;bottom:80px;background:var(--bg);padding:8px 0;border-top:1px solid var(--border)">
          <div style="display:flex;gap:8px">
            <input type="text" id="thread-reply-input" placeholder="Write a reply..." 
              style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:10px;font-size:0.82rem;background:var(--card-bg);color:var(--text)"
              onkeydown="if(event.key==='Enter')ThreadsPage.sendReply('${channelId}','${threadId}')">
            <button onclick="ThreadsPage.sendReply('${channelId}','${threadId}')"
              style="padding:10px 16px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:0.82rem;font-weight:600;cursor:pointer">Send</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Public API ── */

  function render() {
    if (_activeThread && _activeChannel) return _renderThreadDetail(_activeChannel, _activeThread);
    if (_activeChannel) return _renderThreadList(_activeChannel);
    return _renderChannels();
  }

  function openChannel(id) {
    _activeChannel = id;
    _activeThread = null;
    App.refresh();
  }

  function backToChannels() {
    _activeChannel = null;
    _activeThread = null;
    App.refresh();
  }

  function openThread(channelId, threadId) {
    _activeChannel = channelId;
    _activeThread = threadId;
    App.refresh();
  }

  function sendReply(channelId, threadId) {
    const input = document.getElementById('thread-reply-input');
    if (!input || !input.value.trim()) return;
    const settings = Store.getSettings();
    Store.addThreadMessage({
      threadId: threadId,
      author: settings.name || 'You',
      text: input.value.trim(),
      reactions: {}
    });
    App.refresh();
  }

  function newThread(channelId) {
    const title = prompt('Thread title:');
    if (!title) return;
    const msg = prompt('First message:');
    if (!msg) return;
    const settings = Store.getSettings();
    const thread = Store.addThread({
      channelId: channelId,
      title: title,
      author: settings.name || 'You',
      preview: msg.slice(0, 100),
      pinned: false,
    });
    Store.addThreadMessage({
      threadId: thread.id,
      author: settings.name || 'You',
      text: msg,
      reactions: {}
    });
    openThread(channelId, thread.id);
  }

  let _reactionMessageId = null;
  function showReactionPicker(msgId) {
    _reactionMessageId = msgId;
    const picker = document.getElementById('reaction-picker');
    if (picker) picker.style.display = 'block';
  }

  function addReaction(emoji) {
    if (_reactionMessageId) {
      Store.addThreadReaction(_reactionMessageId, emoji, 'You');
      _reactionMessageId = null;
    }
    const picker = document.getElementById('reaction-picker');
    if (picker) picker.style.display = 'none';
    App.refresh();
  }

  function toggleReaction(msgId, emoji) {
    Store.toggleThreadReaction(msgId, emoji, 'You');
    App.refresh();
  }

  function resetNav() {
    _activeChannel = null;
    _activeThread = null;
  }

  return {
    render, openChannel, backToChannels, openThread,
    sendReply, newThread, showReactionPicker, addReaction, toggleReaction, resetNav
  };
})();
