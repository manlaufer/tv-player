(() => {
  'use strict';

  const STORAGE_KEYS = {
    SETTINGS: 'iptv_settings_v1',
    FAVORITES: 'iptv_favorites_v1',
    RECENTS: 'iptv_recents_v1',
    RECENT_ITEMS: 'iptv_recent_items_v1',
    LAST_CHANNEL: 'iptv_last_channel_v1',
    LAST_CHANNEL_URL: 'iptv_last_channel_url_v1',
    PLAYLIST_META: 'iptv_playlist_meta_v1',
    XTREAM_CREDS: 'iptv_xtream_creds_v1',
    PIN_CODE: 'iptv_pin_v1',
    LOCKED_CATS: 'iptv_locked_cats_v1',
    PROFILES: 'iptv_profiles_v1',
    ACTIVE_PROFILE: 'iptv_active_profile_v1',
    KEY_MAP: 'iptv_key_map_v1',
    SOURCES: 'iptv_playlist_sources_v1'
  };

  const ASPECT_MODES = ['contain', 'cover', 'fill'];
  const OSD_ICONS = {
    play: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>',
    pause: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>',
    mute: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
    unmute: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>',
    starOutline: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    starFilled: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"></polygon></svg>',
    aspect: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><polyline points="7 15 7 11 11 11"></polyline><polyline points="17 9 17 13 13 13"></polyline></svg>'
  };
  const DB_NAME = 'LivingRoomIPTV';
  const DB_VERSION = 1;
  const DB_STORE = 'kv';

  const state = {
    channels: [],
    vodItems: [],
    seriesItems: [],
    seriesEpisodes: [],
    activeSeries: null,
    contentMode: 'live', // 'live' | 'vod' | 'series' | 'catchup'
    filteredChannels: [],
    categories: [],
    selectedCategory: 'ALL',
    searchQuery: '',
    favorites: new Set(),
    favoriteStore: { folders: [{ id: 'general', name: 'General', order: 0 }], items: [] },
    activeFavFolderId: 'ALL',
    favMoveTargetKey: null,
    favPickerChannel: null,
    recents: [],
    recentItems: {},
    currentChannel: null,
    epgMap: Object.create(null), // key: lowercase channel id or normalized name -> array of {start, stop, title, desc}
    epgChannelCount: 0,
    epgProgramCount: 0,
    epgLastUpdatedMs: 0,
    epgLookupIndex: null,
    epgNormalizedIndex: null,
    epgPrefixKeys: [],
    epgLastError: '',
    epgChannelNames: null,
    isStartupRefreshing: false,
    epgWindowStart: 0,
    epgSelectedDayOffset: 0,
    chGuideDayOffset: 0,
    splitGuideDayOffset: 0,
    epgSelectedChannel: null,
    epgSelectedProgram: null,
    dvrSchedules: [],
    dvrPendingTarget: null,
    dvrPendingCancelSchedule: null,
    aspectIndex: 0,
    pinCode: '',
    lockedCategories: new Set(),
    unlockedCategories: new Set(),
    pinBuffer: '',
    pinCallback: null,
    profiles: [],
    activeProfileId: '',
    sources: [],
    replacingSourceId: '',
    netShares: [],
    activeNetShare: null,
    netShareSubpath: '',
    netShareFolders: [],
    netShareFiles: [],
    worker: null,
    mediaRecorder: null,
    recordedChunks: [],
    recStartMs: 0,
    recTimer: null,
    reminders: [],
    diagnosticsVisible: false,
    lastBitrateKbps: 0,
    lastFrameCount: 0,
    lastFrameTime: 0,
    measuredFps: 0,
    reconnectAttempts: 0,
    reconnectTimer: null,
    lastPlayOptions: {},
    extSubBlobUrl: '',
    extSubTrackEl: null,
    extSubBaseCues: [],
    subOffsetMs: 0,
    settings: {
      useProxy: true,
      osdTimeout: 3000
    },
    hls: null,
    osdTimer: null,
    toastTimer: null,
    numBuffer: '',
    numTimer: null,
    isPlaying: false,
    hostPowerSleep: false,
    playGeneration: 0,
    startupRetryTimer: null,
    videoCheckTimer: null,
    unmuteBannerEl: null,
    keyMap: {},
    capturingActionId: null,
    gamepadPrevButtons: new Map(),
    tgAuthenticated: false,
    tgCodeSent: false,
    tgPhone: '',
    tgPhoneCodeHash: '',
    tgUser: null,
    tgChannels: [],
    activeTgChannel: null,
    tgVideos: [],
    tgGlobalVideos: [],
    tgSearchTimer: null,
    tgSearchAbort: null,
    osdSeeking: false,
    userPaused: false,
    mpvActive: false,
    isMpvPlaying: false,
    lastPendingPlayArgs: null,
    mpvPaused: false,
    mpvMuted: false,
    mpvPosition: 0,
    mpvDuration: 0,
    mpvTracks: [],
    catchupSeekOffsetSec: 0,
    pendingCatchupSeek: null
  };

  // DOM References
  const el = {
    playerStage: document.getElementById('playerStage'),
    video: document.getElementById('videoPlayer'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    bufferPercent: document.getElementById('buffer-percent'),
    emptyOverlay: document.getElementById('emptyStateOverlay'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptySubtitle: document.getElementById('emptySubtitle'),
    emptySetupBtn: document.getElementById('emptySetupBtn'),
    emptyChannelsBtn: document.getElementById('emptyChannelsBtn'),
    channelNumberEntry: document.getElementById('channelNumberEntry'),
    recIndicator: document.getElementById('recIndicator'),
    recTimerText: document.getElementById('recTimerText'),
    diagnosticsPanel: document.getElementById('diagnosticsPanel'),
    diagConn: document.getElementById('diagConn'),
    diagRes: document.getElementById('diagRes'),
    diagBitrate: document.getElementById('diagBitrate'),
    diagFps: document.getElementById('diagFps'),
    diagBuffer: document.getElementById('diagBuffer'),
    diagDropped: document.getElementById('diagDropped'),
    playlistBadge: document.getElementById('playlistBadge'),
    clockDisplay: document.getElementById('clockDisplay'),
    btnOpenChannels: document.getElementById('btnOpenChannels'),
    btnOpenGuide: document.getElementById('btnOpenGuide'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    btnFullscreen: document.getElementById('btnFullscreen'),
    btnExitApp: document.getElementById('btnExitApp'),
    osdLogo: document.getElementById('osdLogo'),
    osdLogoFallback: document.getElementById('osdLogoFallback'),
    osdNumber: document.getElementById('osdNumber'),
    osdName: document.getElementById('osdName'),
    osdCategory: document.getElementById('osdCategory'),
    osdStreamMeta: document.getElementById('osdStreamMeta'),
    osdNowTitle: document.getElementById('osdNowTitle'),
    osdNowTime: document.getElementById('osdNowTime'),
    osdProgressTrack: document.getElementById('osdProgressTrack'),
    osdProgressFill: document.getElementById('osdProgressFill'),
    osdSeekRow: document.getElementById('osdSeekRow'),
    osdSeekBar: document.getElementById('osdSeekBar'),
    osdCurrentTime: document.getElementById('osdCurrentTime'),
    osdTotalTime: document.getElementById('osdTotalTime'),
    osdNextTitle: document.getElementById('osdNextTitle'),
    osdAudioSelect: document.getElementById('osdAudioSelect'),
    osdSubSelect: document.getElementById('osdSubSelect'),
    osdSubLoadBtn: document.getElementById('osdSubLoadBtn'),
    osdSubFileInput: document.getElementById('osdSubFileInput'),
    osdSubDelayMinusBtn: document.getElementById('osdSubDelayMinusBtn'),
    osdSubDelayLabel: document.getElementById('osdSubDelayLabel'),
    osdSubDelayPlusBtn: document.getElementById('osdSubDelayPlusBtn'),
    osdAspectBtn: document.getElementById('osdAspectBtn'),
    osdRecordBtn: document.getElementById('osdRecordBtn'),
    osdStatsBtn: document.getElementById('osdStatsBtn'),
    osdGuideBtn: document.getElementById('osdGuideBtn'),
    btnOsdSplitGuide: document.getElementById('btnOsdSplitGuide'),
    osdPrevBtn: document.getElementById('osdPrevBtn'),
    osdPlayPauseBtn: document.getElementById('osdPlayPauseBtn'),
    osdStopBtn: document.getElementById('osdStopBtn'),
    osdMuteBtn: document.getElementById('osdMuteBtn'),
    osdFavBtn: document.getElementById('osdFavBtn'),
    osdNextBtn: document.getElementById('osdNextBtn'),
    channelGuideModal: document.getElementById('channelGuideModal'),
    chGuideChannelName: document.getElementById('chGuideChannelName'),
    chGuideRangeBadge: document.getElementById('chGuideRangeBadge'),
    chGuideLiveBtn: document.getElementById('chGuideLiveBtn'),
    chGuideFullGridBtn: document.getElementById('chGuideFullGridBtn'),
    chGuideCloseBtn: document.getElementById('chGuideCloseBtn'),
    chGuideDayBar: document.getElementById('chGuideDayBar'),
    chGuideList: document.getElementById('chGuideList'),
    channelDrawer: document.getElementById('channelDrawer'),
    contentModeTabs: document.getElementById('contentModeTabs'),
    seriesBackBar: document.getElementById('seriesBackBar'),
    btnSeriesBack: document.getElementById('btnSeriesBack'),
    seriesBackTitle: document.getElementById('seriesBackTitle'),
    telegramBackBar: document.getElementById('telegramBackBar'),
    btnTelegramBack: document.getElementById('btnTelegramBack'),
    telegramBackTitle: document.getElementById('telegramBackTitle'),
    netshareBackBar: document.getElementById('netshareBackBar'),
    btnNetshareBack: document.getElementById('btnNetshareBack'),
    netshareBackTitle: document.getElementById('netshareBackTitle'),
    btnCloseDrawer: document.getElementById('btnCloseDrawer'),
    drawerChannelCount: document.getElementById('drawerChannelCount'),
    channelSearchInput: document.getElementById('channelSearchInput'),
    favFolderBar: document.getElementById('favFolderBar'),
    favFolderModal: document.getElementById('favFolderModal'),
    favModalTitle: document.getElementById('favModalTitle'),
    favModalSubtitle: document.getElementById('favModalSubtitle'),
    favNewFolderInput: document.getElementById('favNewFolderInput'),
    favCreateFolderBtn: document.getElementById('favCreateFolderBtn'),
    favFolderValidation: document.getElementById('favFolderValidation'),
    favFolderManagerList: document.getElementById('favFolderManagerList'),
    favRemoveItemBtn: document.getElementById('favRemoveItemBtn'),
    favModalCloseBtn: document.getElementById('favModalCloseBtn'),
    categoryList: document.getElementById('categoryList'),
    channelList: document.getElementById('channelList'),
    epgOverlay: document.getElementById('epgOverlay'),
    epgDayBar: document.getElementById('epgDayBar'),
    epgDateLabel: document.getElementById('epgDateLabel'),
    epgPrevWindowBtn: document.getElementById('epgPrevWindowBtn'),
    epgNowBtn: document.getElementById('epgNowBtn'),
    epgNextWindowBtn: document.getElementById('epgNextWindowBtn'),
    btnCloseEpg: document.getElementById('btnCloseEpg'),
    epgDetailChannel: document.getElementById('epgDetailChannel'),
    epgDetailTime: document.getElementById('epgDetailTime'),
    epgDetailTitle: document.getElementById('epgDetailTitle'),
    epgDetailDesc: document.getElementById('epgDetailDesc'),
    epgReminderAutoTune: document.getElementById('epgReminderAutoTune'),
    epgReminderBtn: document.getElementById('epgReminderBtn'),
    epgWatchBtn: document.getElementById('epgWatchBtn'),
    epgGrid: document.getElementById('epgGrid'),
    splitGuidePanel: document.getElementById('splitGuidePanel'),
    splitGuideChannelBadge: document.getElementById('splitGuideChannelBadge'),
    btnCloseSplitGuide: document.getElementById('btnCloseSplitGuide'),
    splitGuideDayBar: document.getElementById('splitGuideDayBar'),
    splitGuideList: document.getElementById('splitGuideList'),
    settingsModal: document.getElementById('settingsModal'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    settingsTabs: document.getElementById('settingsTabs'),
    sourcesCountBadge: document.getElementById('sourcesCountBadge'),
    configuredSourcesList: document.getElementById('configuredSourcesList'),
    netshareNameInput: document.getElementById('netshareNameInput'),
    netsharePathInput: document.getElementById('netsharePathInput'),
    netshareUserInput: document.getElementById('netshareUserInput'),
    netsharePassInput: document.getElementById('netsharePassInput'),
    netsharePassToggleBtn: document.getElementById('netsharePassToggleBtn'),
    netshareAddBtn: document.getElementById('netshareAddBtn'),
    netshareSavedList: document.getElementById('netshareSavedList'),
    m3uUrlInput: document.getElementById('m3uUrlInput'),
    m3uUserAgentInput: document.getElementById('m3uUserAgentInput'),
    loadM3uUrlBtn: document.getElementById('loadM3uUrlBtn'),
    m3uFileInput: document.getElementById('m3uFileInput'),
    xtreamUrlInput: document.getElementById('xtreamUrlInput'),
    xtreamUserInput: document.getElementById('xtreamUserInput'),
    xtreamPassInput: document.getElementById('xtreamPassInput'),
    xtreamFormatSelect: document.getElementById('xtreamFormatSelect'),
    loadXtreamBtn: document.getElementById('loadXtreamBtn'),
    epgUrlInput: document.getElementById('epgUrlInput'),
    loadEpgUrlBtn: document.getElementById('loadEpgUrlBtn'),
    epgFileInput: document.getElementById('epgFileInput'),
    epgSummaryText: document.getElementById('epgSummaryText'),
    profileNameInput: document.getElementById('profileNameInput'),
    profileEpgOverrideInput: document.getElementById('profileEpgOverrideInput'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    profileList: document.getElementById('profileList'),
    exportBackupBtn: document.getElementById('exportBackupBtn'),
    importBackupInput: document.getElementById('importBackupInput'),
    pinSetupInput: document.getElementById('pinSetupInput'),
    savePinBtn: document.getElementById('savePinBtn'),
    clearPinBtn: document.getElementById('clearPinBtn'),
    pinStatusText: document.getElementById('pinStatusText'),
    lockedCategoriesList: document.getElementById('lockedCategoriesList'),
    prefUseProxy: document.getElementById('prefUseProxy'),
    prefOsdTimeout: document.getElementById('prefOsdTimeout'),
    clearDataBtn: document.getElementById('clearDataBtn'),
    factoryResetBtn: document.getElementById('factoryResetBtn'),
    confirmFactoryResetBtn: document.getElementById('confirmFactoryResetBtn'),
    cancelFactoryResetBtn: document.getElementById('cancelFactoryResetBtn'),
    resetKeyMapBtn: document.getElementById('resetKeyMapBtn'),
    keyCaptureBanner: document.getElementById('keyCaptureBanner'),
    keyCaptureText: document.getElementById('keyCaptureText'),
    cancelKeyCaptureBtn: document.getElementById('cancelKeyCaptureBtn'),
    keyMapperList: document.getElementById('keyMapperList'),
    tgStatusBadge: document.getElementById('tgStatusBadge'),
    tgQrStartBtn: document.getElementById('tgQrStartBtn'),
    tgQrCancelBtn: document.getElementById('tgQrCancelBtn'),
    tgLogoutBtn: document.getElementById('tgLogoutBtn'),
    tgQrContainer: document.getElementById('tgQrContainer'),
    tgQrSvgBox: document.getElementById('tgQrSvgBox'),
    tgQrTimer: document.getElementById('tgQrTimer'),
    tgQrPasswordSection: document.getElementById('tgQrPasswordSection'),
    tgPasswordInput: document.getElementById('tgPasswordInput'),
    tgQrPasswordBtn: document.getElementById('tgQrPasswordBtn'),
    tgAuthStatus: document.getElementById('tgAuthStatus'),
    tgInlineStatus: document.getElementById('tgInlineStatus'),
    settingsStatus: document.getElementById('settingsStatus'),
    pinModal: document.getElementById('pinModal'),
    pinModalPrompt: document.getElementById('pinModalPrompt'),
    pinDots: document.getElementById('pinDots'),
    pinErrorText: document.getElementById('pinErrorText'),
    pinKeypad: document.getElementById('pinKeypad'),
    exitModal: document.getElementById('exitModal'),
    exitCancelBtn: document.getElementById('exitCancelBtn'),
    exitConfirmBtn: document.getElementById('exitConfirmBtn'),
    dvrScheduleModal: document.getElementById('dvrScheduleModal'),
    dvrStepSetup: document.getElementById('dvrStepSetup'),
    dvrSetupProgramLabel: document.getElementById('dvrSetupProgramLabel'),
    dvrSaveDirInput: document.getElementById('dvrSaveDirInput'),
    dvrFileNameInput: document.getElementById('dvrFileNameInput'),
    dvrSetupCancelBtn: document.getElementById('dvrSetupCancelBtn'),
    dvrSetupNextBtn: document.getElementById('dvrSetupNextBtn'),
    dvrStepConfirm: document.getElementById('dvrStepConfirm'),
    dvrConfirmProgram: document.getElementById('dvrConfirmProgram'),
    dvrConfirmChannel: document.getElementById('dvrConfirmChannel'),
    dvrConfirmDate: document.getElementById('dvrConfirmDate'),
    dvrConfirmTime: document.getElementById('dvrConfirmTime'),
    dvrConfirmPath: document.getElementById('dvrConfirmPath'),
    dvrConfirmCancelBtn: document.getElementById('dvrConfirmCancelBtn'),
    dvrConfirmSubmitBtn: document.getElementById('dvrConfirmSubmitBtn'),
    dvrCancelModal: document.getElementById('dvrCancelModal'),
    dvrCancelProgram: document.getElementById('dvrCancelProgram'),
    dvrCancelTime: document.getElementById('dvrCancelTime'),
    dvrCancelPath: document.getElementById('dvrCancelPath'),
    dvrKeepBtn: document.getElementById('dvrKeepBtn'),
    dvrConfirmCancelRecordBtn: document.getElementById('dvrConfirmCancelRecordBtn'),
    toast: document.getElementById('toast')
  };

  // IndexedDB Helpers for large playlists and EPG data
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbSet(key, value) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB write failed:', err);
    }
  }

  async function dbGet(key) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB read failed:', err);
      return null;
    }
  }

  async function dbClear() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB clear failed:', err);
    }
  }

  // Utility Functions
  function showToast(message, durationMs = 2800) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, durationMs);
  }

  function setSettingsStatus(message, type = 'info') {
    el.settingsStatus.textContent = message;
    el.settingsStatus.className = 'settings-status';
    if (type === 'error') el.settingsStatus.classList.add('error');
    if (type === 'success') el.settingsStatus.classList.add('success');
    el.settingsStatus.classList.remove('hidden');
  }

  function buildUrl(targetUrl, cacheBust = 0, useProxyOverride = null) {
    if (!targetUrl) return '';
    const useProxy = useProxyOverride !== null ? useProxyOverride : state.settings.useProxy;
    if (!useProxy) return targetUrl;
    if (targetUrl.startsWith('/proxy?url=')) {
      return cacheBust ? `${targetUrl}&_cb=${cacheBust}` : targetUrl;
    }
    const proxied = '/proxy?url=' + encodeURIComponent(targetUrl);
    return cacheBust ? `${proxied}&_cb=${cacheBust}` : proxied;
  }

  async function waitForProxyReady(maxAttempts = 15, delayMs = 300) {
    if (!state.settings.useProxy) return true;
    const healthUrl = 'http://127.0.0.1:8765/health';
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const resp = await fetch(healthUrl, { cache: 'no-store' });
        if (resp.ok) return true;
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return false;
  }

  async function abortStaleProxyConnections() {
    if (!state.settings.useProxy) return;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 800) : null;
    try {
      await fetch('/proxy/abort', {
        method: 'POST',
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (_) {
      // Ignore abort errors when server is shutting down or unreachable
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const utf8Decoder = new TextDecoder('utf-8');

  function decodeUtf8Buffer(buf) {
    const str = utf8Decoder.decode(buf);
    return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
  }

  function normalizeKey(str) {
    return (str || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  }

  function formatTime(ms) {
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function updateClock() {
    el.clockDisplay.textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Persistence
  function loadLocalPreferences() {
    try {
      const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (rawSettings) {
        Object.assign(state.settings, JSON.parse(rawSettings));
      }
      const rawFavs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (rawFavs) {
        loadFavoriteStore(JSON.parse(rawFavs));
      } else {
        loadFavoriteStore(null);
      }
      const rawRecents = localStorage.getItem(STORAGE_KEYS.RECENTS);
      if (rawRecents) {
        state.recents = JSON.parse(rawRecents);
      }
      const rawRecentItems = localStorage.getItem(STORAGE_KEYS.RECENT_ITEMS);
      if (rawRecentItems) {
        const parsedItems = JSON.parse(rawRecentItems);
        if (parsedItems && typeof parsedItems === 'object') {
          let dirtyRecent = false;
          for (const id of Object.keys(parsedItems)) {
            const cleaned = sanitizeChannelEntry(parsedItems[id], 0);
            if (cleaned !== parsedItems[id]) {
              parsedItems[id] = cleaned;
              dirtyRecent = true;
            }
          }
          state.recentItems = parsedItems;
          if (dirtyRecent) {
            localStorage.setItem(STORAGE_KEYS.RECENT_ITEMS, JSON.stringify(parsedItems));
          }
        }
      }
      const rawMeta = localStorage.getItem(STORAGE_KEYS.PLAYLIST_META);
      if (rawMeta) {
        const meta = JSON.parse(rawMeta);
        if (meta.m3uUrl) el.m3uUrlInput.value = meta.m3uUrl;
        if (meta.m3uUserAgent && el.m3uUserAgentInput) el.m3uUserAgentInput.value = meta.m3uUserAgent;
        if (meta.epgUrl) el.epgUrlInput.value = meta.epgUrl;
      }
      const rawXtream = localStorage.getItem(STORAGE_KEYS.XTREAM_CREDS);
      if (rawXtream) {
        const x = JSON.parse(rawXtream);
        el.xtreamUrlInput.value = x.url || '';
        el.xtreamUserInput.value = x.user || '';
        el.xtreamPassInput.value = x.pass || '';
        if (x.format) el.xtreamFormatSelect.value = x.format;
      }
      state.pinCode = localStorage.getItem(STORAGE_KEYS.PIN_CODE) || '';
      const rawLocked = localStorage.getItem(STORAGE_KEYS.LOCKED_CATS);
      if (rawLocked) {
        state.lockedCategories = new Set(JSON.parse(rawLocked));
      }
      const rawProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (rawProfiles) {
        state.profiles = JSON.parse(rawProfiles);
      }
      state.activeProfileId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE) || '';
      const rawSources = localStorage.getItem(STORAGE_KEYS.SOURCES);
      if (rawSources) {
        state.sources = JSON.parse(rawSources);
      } else {
        const migrated = [];
        if (rawMeta) {
          const meta = JSON.parse(rawMeta);
          if (meta.m3uUrl) {
            migrated.push({
              id: 'src_m3u_default',
              type: 'm3u_url',
              label: meta.m3uUrl,
              m3uUrl: meta.m3uUrl,
              epgUrl: meta.epgUrl || '',
              channelCount: 0,
              updatedAt: Date.now()
            });
          }
        }
        if (rawXtream) {
          const x = JSON.parse(rawXtream);
          if (x.url && x.user) {
            migrated.push({
              id: 'src_xtream_default',
              type: 'xtream',
              label: `${x.user}@${x.url}`,
              xtream: { url: x.url, user: x.user, pass: x.pass || '', format: x.format || 'm3u8' },
              epgUrl: `${x.url.replace(/\/+$/, '')}/xmltv.php?username=${encodeURIComponent(x.user)}&password=${encodeURIComponent(x.pass || '')}`,
              channelCount: 0,
              updatedAt: Date.now()
            });
          }
        }
        state.sources = migrated;
        if (migrated.length) localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(migrated));
      }
      loadKeyMap();
    } catch (err) {
      console.warn('Failed to load local preferences:', err);
    }

    el.prefUseProxy.checked = Boolean(state.settings.useProxy);
    el.prefOsdTimeout.value = String(state.settings.osdTimeout);
    updatePinStatusUi();
    renderProfiles();
    renderKeyMapper();
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
  }

  function syncFavoritesSet() {
    state.favorites = new Set(state.favoriteStore.items.map((item) => item.key));
  }

  function loadFavoriteStore(raw) {
    const baseFolders = [{ id: 'general', name: 'General', order: 0 }];
    let folders = baseFolders;
    let items = [];

    if (Array.isArray(raw)) {
      // Migrate legacy flat favorite IDs into default General folder
      items = raw
        .filter((k) => k !== null && k !== undefined && String(k).trim() !== '')
        .map((k) => ({
          key: String(k),
          type: 'live',
          folderId: 'general',
          channelData: null
        }));
    } else if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.folders) && raw.folders.length) {
        const seenIds = new Set();
        const normalized = [];
        for (let i = 0; i < raw.folders.length; i++) {
          const f = raw.folders[i];
          if (!f || !f.id || seenIds.has(f.id)) continue;
          seenIds.add(f.id);
          normalized.push({
            id: String(f.id),
            name: String(f.name || f.id).trim() || 'Folder',
            order: Number.isFinite(Number(f.order)) ? Number(f.order) : i
          });
        }
        if (!seenIds.has('general')) {
          normalized.unshift({ id: 'general', name: 'General', order: 0 });
        }
        folders = normalized.sort((a, b) => a.order - b.order);
      }
      const validFolderIds = new Set(folders.map((f) => f.id));
      let dirtyFavs = false;
      if (Array.isArray(raw.items)) {
        const seenKeys = new Set();
        for (const entry of raw.items) {
          if (!entry || !entry.key || seenKeys.has(entry.key)) continue;
          seenKeys.add(entry.key);
          let chData = entry.channelData || null;
          if (chData && typeof chData === 'object') {
            const cleaned = sanitizeChannelEntry(chData, 0);
            if (cleaned !== chData) {
              chData = cleaned;
              dirtyFavs = true;
            }
          }
          items.push({
            key: String(entry.key),
            type: String(entry.type || 'live'),
            folderId: validFolderIds.has(entry.folderId) ? entry.folderId : 'general',
            channelData: chData
          });
        }
      }
      state.favoriteStore = { folders, items };
      syncFavoritesSet();
      if (dirtyFavs) {
        saveFavorites();
      }
      return;
    }

    state.favoriteStore = { folders, items };
    syncFavoritesSet();
    if (Array.isArray(raw)) {
      saveFavorites();
    }
  }

  function saveFavorites() {
    syncFavoritesSet();
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(state.favoriteStore));
  }

  function saveRecents() {
    const trimmed = state.recents.slice(0, 40);
    state.recents = trimmed;
    const pruned = {};
    for (const id of trimmed) {
      if (state.recentItems[id]) {
        pruned[id] = state.recentItems[id];
      }
    }
    state.recentItems = pruned;
    localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(trimmed));
    localStorage.setItem(STORAGE_KEYS.RECENT_ITEMS, JSON.stringify(pruned));
  }

  function recordRecentWatch(channel) {
    if (!channel || !channel.id) return;
    state.recents = [channel.id, ...state.recents.filter((id) => id !== channel.id)].slice(0, 40);
    state.recentItems[channel.id] = snapshotFavoriteChannel(channel);
    saveRecents();
    renderCategories();
    if (state.selectedCategory === 'RECENT') {
      filterAndRenderChannels();
    }
  }

  // M3U Parser
  function parseM3u(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    let pending = null;
    let pendingGroup = '';
    let headerCatchupType = '';
    let headerCatchupDays = 0;
    let headerCatchupSource = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTM3U')) {
        const hAttrRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let hm;
        const hAttrs = {};
        while ((hm = hAttrRegex.exec(line)) !== null) {
          hAttrs[hm[1].toLowerCase()] = (hm[2] !== undefined ? hm[2] : (hm[3] || '')).trim();
        }
        headerCatchupType = (hAttrs['catchup'] || hAttrs['catchup-type'] || '').toLowerCase();
        headerCatchupDays = Number(hAttrs['catchup-days'] || hAttrs['tvg-rec'] || hAttrs['timeshift'] || 0) || 0;
        headerCatchupSource = hAttrs['catchup-source'] || '';
        continue;
      }

      if (line.startsWith('#EXTINF:')) {
        // Extract channel title strictly after the last comma outside single or double quotes
        let quoteChar = '';
        let lastComma = -1;
        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          if (quoteChar) {
            if (ch === '\\' && c + 1 < line.length) {
              c++;
              continue;
            }
            if (ch === quoteChar) quoteChar = '';
          } else {
            if (ch === '"' || ch === "'") quoteChar = ch;
            else if (ch === ',') lastComma = c;
          }
        }
        const headerPart = lastComma >= 0 ? line.slice(0, lastComma) : line;
        const attrs = {};
        const attrRegex = /([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)')/g;
        let match;
        while ((match = attrRegex.exec(headerPart)) !== null) {
          const val = (match[2] !== undefined ? match[2] : match[3] || '').trim();
          attrs[match[1].toLowerCase()] = val;
        }

        let rawTitle = lastComma >= 0 ? line.slice(lastComma + 1).trim() : '';
        rawTitle = rawTitle
          .replace(/\b(?:tvg-id|tvg-name|tvg-logo|tvg-chno|tvg-shift|tvg-rec|group-title|http-user-agent|http-referrer|catchup|catchup-type|catchup-days|catchup-source|timeshift)=(?:"[^"]*"|'[^']*'|[^\s,]+)/gi, '')
          .trim();
        const name = rawTitle || attrs['tvg-name'] || 'Channel ' + (channels.length + 1);
        const catchupType = (attrs['catchup'] || attrs['catchup-type'] || headerCatchupType || '').toLowerCase();
        const rawDays = Number(attrs['catchup-days'] || attrs['tvg-rec'] || attrs['timeshift'] || headerCatchupDays || 0);
        const catchupSource = attrs['catchup-source'] || headerCatchupSource || '';
        const catchupDays = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : ((catchupType || catchupSource) ? 7 : 0);

        pending = {
          name,
          tvgId: attrs['tvg-id'] || '',
          tvgName: attrs['tvg-name'] || name,
          logo: attrs['tvg-logo'] || '',
          group: attrs['group-title'] || pendingGroup || 'Uncategorized',
          catchupType,
          catchupDays,
          catchupSource
        };
      } else if (line.startsWith('#EXTGRP:')) {
        const grp = line.slice(8).trim();
        if (pending) pending.group = grp || pending.group;
        else pendingGroup = grp;
      } else if (!line.startsWith('#')) {
        if (/^https?:\/\//i.test(line)) {
          const num = channels.length + 1;
          const info = pending || {
            name: 'Channel ' + num,
            tvgId: '',
            tvgName: 'Channel ' + num,
            logo: '',
            group: pendingGroup || 'Uncategorized',
            catchupType: '',
            catchupDays: 0,
            catchupSource: ''
          };
          channels.push({
            id: info.tvgId ? info.tvgId + '::' + num : 'ch_' + num + '_' + normalizeKey(info.name),
            number: num,
            name: info.name,
            tvgId: info.tvgId,
            tvgName: info.tvgName,
            logo: info.logo,
            group: info.group || 'Uncategorized',
            url: line,
            contentType: 'live',
            catchupType: info.catchupType || '',
            catchupDays: info.catchupDays || 0,
            catchupSource: info.catchupSource || ''
          });
        }
        pending = null;
        pendingGroup = '';
      }
    }

    return channels;
  }

  // XMLTV Parser
  function parseXmltvTimestamp(raw) {
    if (!raw) return 0;
    const cleaned = raw.trim();
    const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*(Z|[+-]\d{2}:?\d{2}))?/i);
    if (!m) return 0;

    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const min = Number(m[5]);
    const sec = Number(m[6]);

    if (m[7]) {
      const tz = m[7].toUpperCase();
      if (tz === 'Z') {
        return Date.UTC(year, month, day, hour, min, sec);
      }
      const sign = tz[0] === '-' ? -1 : 1;
      const digits = tz.slice(1).replace(':', '');
      const offH = Number(digits.slice(0, 2));
      const offM = Number(digits.slice(2, 4));
      const offsetMinutes = sign * (offH * 60 + offM);
      return Date.UTC(year, month, day, hour, min, sec) - offsetMinutes * 60000;
    }

    return new Date(year, month, day, hour, min, sec).getTime();
  }

  function parseXmltv(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    if (doc.querySelector('parsererror')) {
      throw new Error('Invalid XMLTV document');
    }

    const epgMap = Object.create(null);
    const channelAliases = Object.create(null);

    const channelNodes = doc.getElementsByTagName('channel');
    for (let i = 0; i < channelNodes.length; i++) {
      const node = channelNodes[i];
      const id = (node.getAttribute('id') || '').trim();
      if (!id) continue;
      const idKey = id.toLowerCase();
      channelAliases[idKey] = idKey;
      const normId = normalizeKey(id);
      if (normId) channelAliases[normId] = idKey;

      const dispNodes = node.getElementsByTagName('display-name');
      for (let j = 0; j < dispNodes.length; j++) {
        const dn = (dispNodes[j].textContent || '').trim();
        if (!dn) continue;
        const dnLower = dn.toLowerCase();
        if (!channelAliases[dnLower]) channelAliases[dnLower] = idKey;
        const normDn = normalizeKey(dn);
        if (normDn && !channelAliases[normDn]) channelAliases[normDn] = idKey;
      }
    }

    const progNodes = doc.getElementsByTagName('programme');
    let progCount = 0;

    for (let i = 0; i < progNodes.length; i++) {
      const p = progNodes[i];
      const chRaw = (p.getAttribute('channel') || '').trim();
      if (!chRaw) continue;

      const start = parseXmltvTimestamp(p.getAttribute('start'));
      const stop = parseXmltvTimestamp(p.getAttribute('stop'));
      if (!start || !stop || stop <= start) continue;

      const titleNode = p.getElementsByTagName('title')[0];
      const descNode = p.getElementsByTagName('desc')[0];
      const title = titleNode ? titleNode.textContent.trim() : 'Untitled Program';
      const desc = descNode ? descNode.textContent.trim() : '';

      const key = chRaw.toLowerCase();
      if (!epgMap[key]) epgMap[key] = [];
      epgMap[key].push({ start, stop, title, desc });
      const normCh = normalizeKey(chRaw);
      if (normCh && !channelAliases[normCh]) {
        channelAliases[normCh] = key;
      }
      progCount++;
    }

    // Sort programs chronologically per channel
    const keys = Object.keys(epgMap);
    for (let i = 0; i < keys.length; i++) {
      epgMap[keys[i]].sort((a, b) => a.start - b.start);
    }

    // Copy aliases for normalized display-name lookups
    const aliasKeys = Object.keys(channelAliases);
    for (let i = 0; i < aliasKeys.length; i++) {
      const alias = aliasKeys[i];
      const target = channelAliases[alias];
      if (!epgMap[alias] && epgMap[target]) {
        epgMap[alias] = epgMap[target];
      }
    }

    return {
      epgMap,
      channelCount: keys.length,
      programCount: progCount
    };
  }

  function cleanChannelTitle(rawName) {
    if (typeof rawName !== 'string') return '';
    let name = rawName.trim();
    if (!name) return '';
    if (/(?:group-title|tvg-|http-user-agent|http-referrer|catchup-|like Gecko|Chrome\/|Safari\/)/i.test(name)) {
      if (name.includes(',')) {
        name = name.slice(name.lastIndexOf(',') + 1).trim();
      }
      name = name
        .replace(/^.*?like Gecko\)\s*Chrome\/[^\s"]+\s*Safari\/[^\s"]*"?\s*/i, '')
        .replace(/\b(?:tvg-id|tvg-name|tvg-logo|tvg-chno|tvg-shift|tvg-rec|group-title|http-user-agent|http-referrer|catchup|catchup-days|catchup-source)=(?:"[^"]*"|'[^']*'|[^\s,]+)\s*,?/gi, '')
        .trim();
    }
    return name;
  }

  function stripResolutionTags(str) {
    return (str || '')
      .replace(/\s*[\(\[](?:4k|uhd|fhd|hd|sd|1080p|720p|480p|576p|h\.?26[45]|hevc|raw|backup)[\)\]]/gi, '')
      .trim();
  }

  function sanitizeChannelEntry(ch, index) {
    if (!ch || typeof ch !== 'object') return ch;
    let name = typeof ch.name === 'string' ? ch.name.trim() : '';
    let tvgId = typeof ch.tvgId === 'string' ? ch.tvgId.trim() : '';
    let tvgName = typeof ch.tvgName === 'string' ? ch.tvgName.trim() : '';
    let logo = typeof ch.logo === 'string' ? ch.logo.trim() : '';
    let group = typeof ch.group === 'string' ? ch.group.trim() : '';
    let catchupType = typeof ch.catchupType === 'string' ? ch.catchupType.trim().toLowerCase() : '';
    let catchupDays = Number(ch.catchupDays || 0) || 0;
    let catchupSource = typeof ch.catchupSource === 'string' ? ch.catchupSource.trim() : '';

    // Recover from previously cached entries where #EXTINF attributes leaked into name
    if (name && (/(?:group-title|tvg-logo|tvg-id|http-user-agent|http-referrer|catchup)\s*=/i.test(name) || /like Gecko\)\s*Chrome\//i.test(name))) {
      const attrRegex = /([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)')/g;
      let m;
      while ((m = attrRegex.exec(name)) !== null) {
        const key = m[1].toLowerCase();
        const val = (m[2] !== undefined ? m[2] : m[3] || '').trim();
        if (key === 'tvg-id' && !tvgId) tvgId = val;
        else if (key === 'tvg-name' && !tvgName) tvgName = val;
        else if (key === 'tvg-logo' && !logo) logo = val;
        else if (key === 'group-title' && (!group || group === 'Uncategorized')) group = val;
        else if ((key === 'catchup' || key === 'catchup-type') && !catchupType) catchupType = val.toLowerCase();
        else if ((key === 'catchup-days' || key === 'tvg-rec' || key === 'timeshift') && !catchupDays) catchupDays = Number(val) || 0;
        else if (key === 'catchup-source' && !catchupSource) catchupSource = val;
      }

      let quoteChar = '';
      let lastComma = -1;
      for (let i = 0; i < name.length; i++) {
        const c = name[i];
        if (quoteChar) {
          if (c === '\\' && i + 1 < name.length) {
            i++;
            continue;
          }
          if (c === quoteChar) quoteChar = '';
        } else {
          if (c === '"' || c === "'") quoteChar = c;
          else if (c === ',') lastComma = i;
        }
      }
      if (lastComma >= 0) {
        name = name.slice(lastComma + 1).trim();
      }
      name = cleanChannelTitle(name);
    } else {
      name = cleanChannelTitle(name);
    }

    if (!name) name = tvgName || 'Channel ' + (index + 1);
    if (!tvgName || /(?:group-title|http-user-agent)=/i.test(tvgName)) tvgName = name;
    if (!group) group = 'Uncategorized';
    if (!catchupDays && (catchupType || catchupSource)) catchupDays = 7;

    if (
      name !== ch.name ||
      tvgId !== (ch.tvgId || '') ||
      tvgName !== (ch.tvgName || '') ||
      logo !== (ch.logo || '') ||
      group !== (ch.group || '') ||
      catchupType !== (ch.catchupType || '') ||
      catchupDays !== (Number(ch.catchupDays || 0) || 0) ||
      catchupSource !== (ch.catchupSource || '')
    ) {
      return Object.assign({}, ch, { name, tvgId, tvgName, logo, group, catchupType, catchupDays, catchupSource });
    }
    return ch;
  }

  const EPG_BILINGUAL_ALIAS_GROUPS = [
    ['כאן 11', 'כאן11', 'kan 11', 'kan11', 'kan 11 il', 'kan11.il'],
    ['קשת 12', 'קשת12', 'keshet 12', 'keshet12', 'channel 12', 'ch 12'],
    ['רשת 13', 'רשת13', 'reshet 13', 'reshet13', 'channel 13', 'ch 13'],
    ['ערוץ 14', 'עכשיו 14', 'ערוץ14', 'עכשיו14', 'channel 14', 'now 14', 'channel14', 'now14'],
    ['כאן חינוכית', 'חינוכית', 'kan educational', 'kan hinuchit', 'kan23'],
    ['מכאן 33', 'מכאן33', 'makan 33', 'makan33'],
    ['ספורט 5', 'ספורט5', 'sport 5', 'sport5'],
    ['one', 'וואן', 'one hd']
  ];

  function stripEpgDecorations(str) {
    if (!str) return '';
    return cleanChannelTitle(String(str))
      .replace(/^\s*(?:\[(?:il|israel|he|heb|us|uk|ru|ar)\]|\|(?:il|israel)\||\((?:il|israel)\)|(?:il|israel)\s*[:|\-]\s*)/gi, '')
      .replace(/[\[\(](?:4k|uhd|fhd|hd|sd|hevc|50fps|60fps|raw|vip|il|israel)[\]\)]/gi, '')
      .replace(/\b(?:4k|uhd|fhd|hd|sd|hevc|h265|50fps|60fps|1080p|720p|raw|vip)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getBilingualAliasKeys(rawKey) {
    const out = [];
    const norm = normalizeKey(stripEpgDecorations(rawKey));
    if (!norm) return out;
    out.push(norm);
    for (let i = 0; i < EPG_BILINGUAL_ALIAS_GROUPS.length; i++) {
      const group = EPG_BILINGUAL_ALIAS_GROUPS[i];
      let matched = false;
      for (let j = 0; j < group.length; j++) {
        if (normalizeKey(group[j]) === norm) {
          matched = true;
          break;
        }
      }
      if (matched) {
        for (let j = 0; j < group.length; j++) {
          const k = normalizeKey(group[j]);
          if (k && !out.includes(k)) out.push(k);
        }
      }
    }
    return out;
  }

  function rebuildEpgLookupIndex(epgMap = state.epgMap, channelNames = state.epgChannelNames) {
    const idx = Object.create(null);
    const prefixList = [];
    const seenPrefix = new Set();
    if (!epgMap || typeof epgMap !== 'object') {
      state.epgLookupIndex = idx;
      state.epgNormalizedIndex = idx;
      state.epgPrefixKeys = prefixList;
      return idx;
    }
    const indexKeyForList = (rawKey, list) => {
      if (!rawKey) return;
      const lower = String(rawKey).trim().toLowerCase();
      if (lower && !idx[lower]) idx[lower] = list;
      const stripped = stripEpgDecorations(rawKey);
      const norm = normalizeKey(stripped);
      if (norm) {
        if (!idx[norm]) idx[norm] = list;
        if (norm.length >= 4 && !seenPrefix.has(norm)) {
          seenPrefix.add(norm);
          prefixList.push({ normKey: norm, list });
        }
      }
      const aliases = getBilingualAliasKeys(rawKey);
      for (let a = 0; a < aliases.length; a++) {
        if (!idx[aliases[a]]) idx[aliases[a]] = list;
      }
    };
    const keys = Object.keys(epgMap);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const list = epgMap[k];
      if (!Array.isArray(list) || !list.length) continue;
      indexKeyForList(k, list);
      if (channelNames && Array.isArray(channelNames[k.toLowerCase()])) {
        const names = channelNames[k.toLowerCase()];
        for (let n = 0; n < names.length; n++) {
          indexKeyForList(names[n], list);
        }
      }
    }
    state.epgLookupIndex = idx;
    state.epgNormalizedIndex = idx;
    state.epgPrefixKeys = prefixList;
    return idx;
  }

  function buildEpgLookupIndex(epgMap = state.epgMap, channelNames = state.epgChannelNames) {
    return rebuildEpgLookupIndex(epgMap, channelNames);
  }

  function getChannelPrograms(channel) {
    if (!channel || !state.epgMap) return [];
    const idx = state.epgLookupIndex || rebuildEpgLookupIndex(state.epgMap, state.epgChannelNames);
    const candidates = [
      (channel.tvgId || channel.epg_channel_id || channel.tvg_id || '').trim(),
      (channel.tvgName || '').trim(),
      (cleanChannelTitle(channel.name) || channel.name || '').trim()
    ].filter(Boolean);

    // Tiers 1-3: Exact, normalized, and bilingual alias lookup
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (state.epgMap[c]) return state.epgMap[c];
      const lower = c.toLowerCase();
      if (state.epgMap[lower]) return state.epgMap[lower];
      if (idx[lower]) return idx[lower];

      const stripped = stripEpgDecorations(c);
      const norm = normalizeKey(stripped);
      if (norm) {
        if (state.epgMap[norm]) return state.epgMap[norm];
        if (idx[norm]) return idx[norm];
      }

      const aliases = getBilingualAliasKeys(c);
      for (let a = 0; a < aliases.length; a++) {
        if (idx[aliases[a]]) return idx[aliases[a]];
      }
    }

    // Tier 4: Token-subset / prefix match (>= 4 chars normalized)
    const prefixList = state.epgPrefixKeys || [];
    if (prefixList.length) {
      for (let i = 0; i < candidates.length; i++) {
        const norm = normalizeKey(stripEpgDecorations(candidates[i]));
        if (!norm || norm.length < 4) continue;
        for (let p = 0; p < prefixList.length; p++) {
          const entry = prefixList[p];
          if (entry.normKey.startsWith(norm) || norm.startsWith(entry.normKey) || entry.normKey.includes(norm) || norm.includes(entry.normKey)) {
            return entry.list;
          }
        }
      }
    }
    return [];
  }

  function getNowAndNext(channel, nowMs = Date.now()) {
    const progs = getChannelPrograms(channel);
    if (!progs.length) return { now: null, next: null };

    let nowProg = null;
    let nextProg = null;
    for (let i = 0; i < progs.length; i++) {
      const p = progs[i];
      if (p.start <= nowMs && p.stop > nowMs) {
        nowProg = p;
        nextProg = progs[i + 1] || null;
        break;
      }
      if (p.start > nowMs) {
        nextProg = p;
        break;
      }
    }
    return { now: nowProg, next: nextProg };
  }

  // Playlist Loading
  async function applyChannels(channels, sourceLabel, options = {}) {
    const silentRefresh = Boolean(options.silentRefresh);
    const cleanedChannels = (Array.isArray(channels) ? channels : []).map((ch, idx) => sanitizeChannelEntry(ch, idx));
    state.channels = cleanedChannels;
    const catSet = new Set();
    for (let i = 0; i < cleanedChannels.length; i++) {
      catSet.add(cleanedChannels[i].group || 'Uncategorized');
    }
    state.categories = Array.from(catSet);
    if (!silentRefresh) {
      state.selectedCategory = 'ALL';
      state.searchQuery = '';
      el.channelSearchInput.value = '';
    } else if (state.selectedCategory !== 'ALL' && !catSet.has(state.selectedCategory)) {
      state.selectedCategory = 'ALL';
    }

    el.playlistBadge.textContent = `${cleanedChannels.length.toLocaleString()} Channels`;
    el.emptyChannelsBtn.classList.toggle('hidden', cleanedChannels.length === 0);

    await dbSet('channels', cleanedChannels);
    renderCategories();
    filterAndRenderChannels();

    if (silentRefresh) {
      if (state.currentChannel && cleanedChannels.length > 0) {
        const updatedCurrent =
          cleanedChannels.find((c) => c.id === state.currentChannel.id) ||
          cleanedChannels.find((c) => c.url === state.currentChannel.url);
        if (updatedCurrent) {
          state.currentChannel = updatedCurrent;
          updateOsd();
        }
      }
      if (channels.length > 0) {
        el.emptyOverlay.classList.add('hidden');
      }
      return;
    }

    if (channels.length > 0) {
      el.emptyOverlay.classList.add('hidden');
      const lastId = localStorage.getItem(STORAGE_KEYS.LAST_CHANNEL);
      const lastUrl = localStorage.getItem(STORAGE_KEYS.LAST_CHANNEL_URL);
      const target =
        channels.find((c) => lastId && c.id === lastId) ||
        channels.find((c) => lastUrl && c.url === lastUrl) ||
        channels[0];
      playChannel(target, { isStartupResume: Boolean(options.isStartupResume) });
      showToast(`Loaded ${channels.length.toLocaleString()} channels (${sourceLabel})`);
    } else {
      el.emptyOverlay.classList.remove('hidden');
      el.emptyTitle.textContent = 'No Channels Found';
      el.emptySubtitle.textContent = 'The playlist did not contain any valid HTTP/HTTPS stream URLs.';
    }
  }

  // Background Web Worker Offloading
  function runWorkerTask(type, payload) {
    if (!window.Worker) {
      return Promise.resolve(
        type === 'parseM3u' ? { channels: parseM3u(payload.text) } : parseXmltv(payload.xmlText)
      );
    }
    return new Promise((resolve, reject) => {
      try {
        if (!state.worker) {
          state.worker = new Worker('worker.js');
        }
        const id = Date.now() + '_' + Math.random().toString(36).slice(2);
        const onMessage = (e) => {
          if (!e.data || e.data.id !== id) return;
          state.worker.removeEventListener('message', onMessage);
          state.worker.removeEventListener('error', onError);
          if (e.data.ok) resolve(e.data);
          else reject(new Error(e.data.error || 'Worker parsing failed'));
        };
        const onError = (err) => {
          state.worker.removeEventListener('message', onMessage);
          state.worker.removeEventListener('error', onError);
          reject(err);
        };
        state.worker.addEventListener('message', onMessage);
        state.worker.addEventListener('error', onError);
        state.worker.postMessage({ id, type, ...payload });
        if (payload && typeof payload === 'object') {
          if ('text' in payload) payload.text = null;
          if ('xmlText' in payload) payload.xmlText = null;
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  function saveSources() {
    localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(state.sources));
  }

  function upsertSource(sourceObj) {
    const idx = state.sources.findIndex((s) => s.id === sourceObj.id);
    if (idx >= 0) {
      state.sources[idx] = { ...state.sources[idx], ...sourceObj };
    } else {
      state.sources.push(sourceObj);
    }
    saveSources();
    renderConfiguredSources();
  }

  async function mergeSourceChannels(sourceId, newChannels, sourceLabel, options = {}) {
    const hadSingleSource = state.sources.length <= 1;
    const preserved = state.channels.filter((c) => {
      if (c.sourceId) return c.sourceId !== sourceId;
      return !hadSingleSource;
    });
    const combined = [...preserved, ...newChannels].map((c, idx) => ({
      ...c,
      number: idx + 1
    }));

    if (options.teardownIfPlaying && state.currentChannel && state.currentChannel.sourceId === sourceId) {
      teardownActiveStream();
      abortStaleProxyConnections();
      state.currentChannel = null;
    }

    await applyChannels(combined, sourceLabel, options);
  }

  function switchSettingsTab(tabId) {
    el.settingsTabs.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('#settingsModal .tab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === tabId);
    });
  }

  async function syncSourceById(sourceId) {
    const src = state.sources.find((s) => s.id === sourceId);
    if (!src) return;
    if (src.type === 'm3u_url' && src.m3uUrl) {
      setSettingsStatus(`Syncing ${src.label}...`, 'info');
      try {
        const resp = await fetch(buildPlaylistFetchUrl(src.m3uUrl, src.userAgent || ''));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = decodeUtf8Buffer(await resp.arrayBuffer());
        const res = await runWorkerTask('parseM3u', { text, sourceId: src.id });
        const channels = res.channels || [];
        await mergeSourceChannels(src.id, channels, 'M3U Sync', { silentRefresh: true });
        upsertSource({
          id: src.id,
          channelCount: channels.length,
          epgUrl: src.epgUrl || res.epgUrl || '',
          updatedAt: Date.now()
        });
        const epgTargets = Array.isArray(res.epgUrls) && res.epgUrls.length
          ? res.epgUrls
          : ((src.epgUrl || res.epgUrl) ? [src.epgUrl || res.epgUrl] : []);
        if (epgTargets.length) await loadAutoEpgUrls(epgTargets, 'M3U Auto-EPG');
        setSettingsStatus(`Synced ${channels.length.toLocaleString()} channels from ${src.label}.`, 'success');
      } catch (err) {
        setSettingsStatus(`Failed to sync source: ${err.message}`, 'error');
      }
      return;
    }

    if (src.type === 'xtream' && src.xtream) {
      setSettingsStatus(`Syncing Xtream source ${src.label}...`, 'info');
      try {
        const { url, user, pass, format } = src.xtream;
        const { channels, vodItems, seriesItems } = await fetchAndParseXtream(url, user, pass, format || 'm3u8', src.id);
        state.vodItems = vodItems;
        state.seriesItems = seriesItems;
        await Promise.all([dbSet('vodItems', vodItems), dbSet('seriesItems', seriesItems)]);
        await mergeSourceChannels(src.id, channels, 'Xtream Sync', { silentRefresh: true });
        upsertSource({
          id: src.id,
          channelCount: channels.length,
          updatedAt: Date.now()
        });
        if (src.epgUrl) await loadEpgFromUrl(src.epgUrl, { silent: true, sourceLabel: 'Xtream XMLTV' });
        setSettingsStatus(`Synced ${channels.length.toLocaleString()} channels from Xtream.`, 'success');
      } catch (err) {
        setSettingsStatus(`Failed to sync Xtream: ${err.message}`, 'error');
      }
      return;
    }

    if (src.type === 'm3u_file') {
      if (src.localM3uPath) {
        setSettingsStatus(`Syncing ${src.fileName || src.label}...`, 'info');
        try {
          const resp = await fetch(`/proxy?file=${encodeURIComponent(src.localM3uPath)}`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const text = decodeUtf8Buffer(await resp.arrayBuffer());
          const res = await runWorkerTask('parseM3u', { text, sourceId: src.id });
          const channels = res.channels || [];
          await mergeSourceChannels(src.id, channels, src.fileName || 'Local M3U', { silentRefresh: true });
          upsertSource({ id: src.id, channelCount: channels.length, updatedAt: Date.now() });
          setSettingsStatus(`Synced ${channels.length.toLocaleString()} channels.`, 'success');
        } catch (err) {
          setSettingsStatus(`Failed to sync local file: ${err.message}`, 'error');
        }
      } else {
        replaceSourceById(src.id);
      }
    }
  }

  function replaceSourceById(sourceId) {
    const src = state.sources.find((s) => s.id === sourceId);
    if (!src) return;
    state.replacingSourceId = src.id;

    if (src.type === 'xtream' && src.xtream) {
      switchSettingsTab('tabXtream');
      el.xtreamUrlInput.value = src.xtream.url || '';
      el.xtreamUserInput.value = src.xtream.user || '';
      el.xtreamPassInput.value = src.xtream.pass || '';
      if (src.xtream.format) el.xtreamFormatSelect.value = src.xtream.format;
      el.xtreamUrlInput.focus();
      setSettingsStatus(`Editing Xtream source "${src.label}". Update credentials and click Connect Xtream Codes to replace.`, 'info');
      return;
    }

    switchSettingsTab('tabM3u');
    if (src.type === 'm3u_file') {
      setSettingsStatus(`Select a replacement M3U file for "${src.label}".`, 'info');
      el.m3uFileInput.click();
      return;
    }
    el.m3uUrlInput.value = src.m3uUrl || '';
    el.m3uUrlInput.focus();
    setSettingsStatus(`Editing M3U source "${src.label}". Enter new URL and click Load M3U URL to replace.`, 'info');
  }

  async function removeSourceById(sourceId) {
    const src = state.sources.find((s) => s.id === sourceId);
    if (!src) return;

    state.sources = state.sources.filter((s) => s.id !== sourceId);
    saveSources();

    const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
    if (src.type === 'm3u_url' && meta.m3uUrl === src.m3uUrl) {
      delete meta.m3uUrl;
      if (el.m3uUrlInput.value.trim() === src.m3uUrl) el.m3uUrlInput.value = '';
    }
    if (src.type === 'xtream') {
      const hasOtherXtream = state.sources.some((s) => s.type === 'xtream');
      if (!hasOtherXtream) {
        localStorage.removeItem(STORAGE_KEYS.XTREAM_CREDS);
        state.vodItems = [];
        state.seriesItems = [];
        await Promise.all([dbSet('vodItems', []), dbSet('seriesItems', [])]);
      }
    }
    if (src.epgUrl && meta.epgUrl === src.epgUrl) {
      delete meta.epgUrl;
      if (el.epgUrlInput.value.trim() === src.epgUrl) el.epgUrlInput.value = '';
    }
    localStorage.setItem(STORAGE_KEYS.PLAYLIST_META, JSON.stringify(meta));

    const playingBelongedToSource =
      state.currentChannel &&
      (state.currentChannel.sourceId === sourceId || (!state.currentChannel.sourceId && state.sources.length === 0));

    if (playingBelongedToSource) {
      teardownActiveStream();
      abortStaleProxyConnections();
      state.currentChannel = null;
      el.loadingOverlay.classList.add('hidden');
      updateOsd();
    }

    const remaining = state.sources.length === 0
      ? []
      : state.channels
          .filter((c) => c.sourceId && c.sourceId !== sourceId)
          .map((c, idx) => ({ ...c, number: idx + 1 }));

    state.channels = remaining;
    const catSet = new Set();
    for (let i = 0; i < remaining.length; i++) {
      catSet.add(remaining[i].group || 'Uncategorized');
    }
    state.categories = Array.from(catSet);
    state.selectedCategory = 'ALL';
    await dbSet('channels', remaining);
    el.playlistBadge.textContent = `${remaining.length.toLocaleString()} Channels`;
    el.emptyChannelsBtn.classList.toggle('hidden', remaining.length === 0);
    if (remaining.length === 0) {
      el.emptyOverlay.classList.remove('hidden');
      el.emptyTitle.textContent = 'No Channels Loaded';
      el.emptySubtitle.textContent = 'Add an M3U URL, local file, or Xtream Codes source in Setup.';
    }

    // Purge EPG records associated with the removed source
    state.epgMap = Object.create(null);
    state.epgChannelCount = 0;
    state.epgProgramCount = 0;
    el.epgSummaryText.textContent = 'No EPG loaded.';
    await dbSet('epg', null);

    const nextEpgSource = state.sources.find((s) => s.epgUrl);
    if (nextEpgSource) {
      loadEpgFromUrl(nextEpgSource.epgUrl, { silent: true, sourceLabel: 'Source EPG' });
    }

    renderCategories();
    filterAndRenderChannels();
    renderConfiguredSources();
    setSettingsStatus(`Removed source "${src.label}" and purged its cached channels & EPG.`, 'success');
  }

  function renderConfiguredSources() {
    if (!el.configuredSourcesList || !el.sourcesCountBadge) return;
    el.sourcesCountBadge.textContent = `${state.sources.length} ${state.sources.length === 1 ? 'source' : 'sources'}`;
    el.configuredSourcesList.innerHTML = '';

    if (state.sources.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'source-row-meta';
      empty.textContent = 'No playlist sources configured yet.';
      el.configuredSourcesList.appendChild(empty);
      return;
    }

    for (let i = 0; i < state.sources.length; i++) {
      const src = state.sources[i];
      const row = document.createElement('div');
      row.className = 'source-row';

      const info = document.createElement('div');
      info.className = 'source-row-info';

      const title = document.createElement('div');
      title.className = 'source-row-title';

      const badge = document.createElement('span');
      badge.className = 'source-type-badge';
      badge.textContent = src.type === 'xtream' ? 'Xtream' : src.type === 'm3u_file' ? 'Local File' : 'M3U URL';

      const label = document.createElement('span');
      label.className = 'source-row-label';
      label.setAttribute('dir', 'auto');
      label.textContent = src.label || src.m3uUrl || src.fileName || 'Unnamed Source';

      title.appendChild(badge);
      title.appendChild(label);

      const metaLine = document.createElement('div');
      metaLine.className = 'source-row-meta';
      const countText = src.channelCount ? `${src.channelCount.toLocaleString()} channels` : 'Cached';
      const epgText = src.epgUrl ? ' · EPG linked' : '';
      metaLine.textContent = `${countText}${epgText}`;

      info.appendChild(title);
      info.appendChild(metaLine);

      const actions = document.createElement('div');
      actions.className = 'source-row-actions';

      const syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.className = 'btn btn-secondary btn-sm focusable';
      syncBtn.textContent = 'Sync Now';
      syncBtn.addEventListener('click', () => syncSourceById(src.id));

      const replaceBtn = document.createElement('button');
      replaceBtn.type = 'button';
      replaceBtn.className = 'btn btn-secondary btn-sm focusable';
      replaceBtn.textContent = 'Replace';
      replaceBtn.addEventListener('click', () => replaceSourceById(src.id));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-danger btn-sm focusable';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeSourceById(src.id));

      actions.appendChild(syncBtn);
      actions.appendChild(replaceBtn);
      actions.appendChild(removeBtn);

      row.appendChild(info);
      row.appendChild(actions);
      el.configuredSourcesList.appendChild(row);
    }
  }

  function buildPlaylistFetchUrl(targetUrl, customUa = '') {
    const clean = String(targetUrl || '').trim();
    if (!clean) return '';
    if (!/^https?:\/\//i.test(clean)) return buildUrl(clean);
    let proxied = '/proxy?url=' + encodeURIComponent(clean) + '&raw=1';
    const ua = String(customUa || '').trim();
    if (ua) {
      proxied += '&ua=' + encodeURIComponent(ua);
    }
    return proxied;
  }

  async function loadM3uFromUrl(url) {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setSettingsStatus('Please enter a valid M3U playlist URL.', 'error');
      return;
    }
    const customUa = (el.m3uUserAgentInput ? el.m3uUserAgentInput.value : '').trim();
    const existing = state.sources.find((s) => s.id === state.replacingSourceId) ||
      state.sources.find((s) => s.type === 'm3u_url' && s.m3uUrl === cleanUrl);
    const sourceId = existing ? existing.id : `src_m3u_${Date.now()}`;
    const isReplacing = Boolean(state.replacingSourceId);

    setSettingsStatus('Downloading and parsing M3U playlist in background...', 'info');
    try {
      const resp = await fetch(buildPlaylistFetchUrl(cleanUrl, customUa));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = decodeUtf8Buffer(await resp.arrayBuffer());
      const res = await runWorkerTask('parseM3u', { text, sourceId });
      const channels = res.channels || [];
      const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
      meta.m3uUrl = cleanUrl;
      if (customUa) meta.m3uUserAgent = customUa;
      else delete meta.m3uUserAgent;
      localStorage.setItem(STORAGE_KEYS.PLAYLIST_META, JSON.stringify(meta));
      await mergeSourceChannels(sourceId, channels, 'M3U URL', { teardownIfPlaying: isReplacing });
      upsertSource({
        id: sourceId,
        type: 'm3u_url',
        label: cleanUrl,
        m3uUrl: cleanUrl,
        userAgent: customUa,
        epgUrl: res.epgUrl || '',
        channelCount: channels.length,
        updatedAt: Date.now()
      });
      state.replacingSourceId = '';
      setSettingsStatus(`Loaded ${channels.length.toLocaleString()} channels successfully.`, 'success');
      closeSettings();
      const epgList = Array.isArray(res.epgUrls) && res.epgUrls.length
        ? res.epgUrls
        : (res.epgUrl ? [res.epgUrl] : []);
      if (epgList.length) {
        meta.autoEpgUrls = epgList;
        localStorage.setItem(STORAGE_KEYS.PLAYLIST_META, JSON.stringify(meta));
        if (!el.epgUrlInput.value.trim()) el.epgUrlInput.value = epgList[0];
      }
      loadEpgCascade(epgList, { sourceLabel: 'M3U Auto-EPG' }).catch(() => {});
    } catch (err) {
      setSettingsStatus(`Failed to load M3U URL: ${err.message}`, 'error');
    }
  }

  async function loadM3uFromFile(file) {
    if (!file) return;
    const existing = state.sources.find((s) => s.id === state.replacingSourceId) ||
      state.sources.find((s) => s.type === 'm3u_file' && s.fileName === file.name);
    const sourceId = existing ? existing.id : `src_file_${Date.now()}`;
    const isReplacing = Boolean(state.replacingSourceId);

    setSettingsStatus(`Parsing ${file.name} in background...`, 'info');
    try {
      const text = decodeUtf8Buffer(await file.arrayBuffer());
      const res = await runWorkerTask('parseM3u', { text, sourceId });
      const channels = res.channels || [];
      await mergeSourceChannels(sourceId, channels, file.name, { teardownIfPlaying: isReplacing });
      upsertSource({
        id: sourceId,
        type: 'm3u_file',
        label: file.name,
        fileName: file.name,
        epgUrl: res.epgUrl || '',
        channelCount: channels.length,
        updatedAt: Date.now()
      });
      state.replacingSourceId = '';
      setSettingsStatus(`Loaded ${channels.length.toLocaleString()} channels from ${file.name}.`, 'success');
      closeSettings();
      const epgList = Array.isArray(res.epgUrls) && res.epgUrls.length
        ? res.epgUrls
        : (res.epgUrl ? [res.epgUrl] : []);
      if (epgList.length) {
        const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
        meta.autoEpgUrls = epgList;
        localStorage.setItem(STORAGE_KEYS.PLAYLIST_META, JSON.stringify(meta));
        if (!el.epgUrlInput.value.trim()) el.epgUrlInput.value = epgList[0];
      }
      loadEpgCascade(epgList, { sourceLabel: 'M3U File Auto-EPG' }).catch(() => {});
    } catch (err) {
      setSettingsStatus(`Failed to parse M3U file: ${err.message}`, 'error');
    }
  }

  async function fetchAndParseXtream(baseUrl, user, pass, fmt, sourceId = '') {
    const authUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    const authResp = await fetch(buildUrl(authUrl));
    if (!authResp.ok) throw new Error(`HTTP ${authResp.status}`);
    const authData = await authResp.json();
    if (!authData.user_info || String(authData.user_info.auth) === '0') {
      throw new Error('Authentication rejected by Xtream server');
    }

    const [catResp, streamResp, vodCatResp, vodResp, serCatResp, serResp] = await Promise.all([
      fetch(buildUrl(`${authUrl}&action=get_live_categories`)),
      fetch(buildUrl(`${authUrl}&action=get_live_streams`)),
      fetch(buildUrl(`${authUrl}&action=get_vod_categories`)).catch(() => null),
      fetch(buildUrl(`${authUrl}&action=get_vod_streams`)).catch(() => null),
      fetch(buildUrl(`${authUrl}&action=get_series_categories`)).catch(() => null),
      fetch(buildUrl(`${authUrl}&action=get_series`)).catch(() => null)
    ]);

    const catJson = catResp.ok ? await catResp.json() : [];
    const streamJson = streamResp.ok ? await streamResp.json() : [];
    if (!Array.isArray(streamJson)) {
      throw new Error('Unexpected stream list response from Xtream server');
    }

    const vodCatJson = vodCatResp && vodCatResp.ok ? await vodCatResp.json() : [];
    const vodJson = vodResp && vodResp.ok ? await vodResp.json() : [];
    const serCatJson = serCatResp && serCatResp.ok ? await serCatResp.json() : [];
    const serJson = serResp && serResp.ok ? await serResp.json() : [];

    if (window.Worker) {
      return runWorkerTask('mapXtreamPayload', {
        sourceId,
        baseUrl,
        user,
        pass,
        fmt,
        catJson,
        streamJson,
        vodCatJson,
        vodJson,
        serCatJson,
        serJson
      });
    }

    const mapCats = (arr) => {
      const m = Object.create(null);
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) {
          m[String(arr[i].category_id)] = arr[i].category_name;
        }
      }
      return m;
    };
    const catMap = mapCats(catJson);
    const vodCatMap = mapCats(vodCatJson);
    const serCatMap = mapCats(serCatJson);
    const channels = streamJson.map((s, idx) => ({
      id: s.epg_channel_id ? `${s.epg_channel_id}::${s.stream_id}` : `xt_${s.stream_id}`,
      streamId: String(s.stream_id),
      number: idx + 1,
      name: s.name || `Channel ${idx + 1}`,
      tvgId: s.epg_channel_id || '',
      epg_channel_id: s.epg_channel_id || '',
      tvgName: s.name || '',
      logo: s.stream_icon || '',
      group: catMap[String(s.category_id)] || 'Live TV',
      url: `${baseUrl}/live/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${s.stream_id}.${fmt}`,
      contentType: 'live',
      catchupDays: Number(s.tv_archive_duration || (s.tv_archive ? 7 : 0))
    }));
    const vodItems = Array.isArray(vodJson) ? vodJson.map((v, idx) => ({
      id: `vod_${v.stream_id}`,
      number: idx + 1,
      name: v.name || `Movie ${idx + 1}`,
      logo: v.stream_icon || '',
      group: vodCatMap[String(v.category_id)] || 'Movies',
      url: `${baseUrl}/movie/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${v.stream_id}.${v.container_extension || 'mp4'}`,
      contentType: 'vod',
      rating: v.rating || ''
    })) : [];
    const seriesItems = Array.isArray(serJson) ? serJson.map((sr, idx) => ({
      id: `series_${sr.series_id}`,
      seriesId: String(sr.series_id),
      number: idx + 1,
      name: sr.name || `Series ${idx + 1}`,
      logo: sr.cover || '',
      group: serCatMap[String(sr.category_id)] || 'Series',
      plot: sr.plot || '',
      contentType: 'series'
    })) : [];
    return { channels, vodItems, seriesItems };
  }

  async function loadXtreamCodes() {
    let baseUrl = el.xtreamUrlInput.value.trim().replace(/\/+$/, '');
    const user = el.xtreamUserInput.value.trim();
    const pass = el.xtreamPassInput.value.trim();
    const fmt = el.xtreamFormatSelect.value || 'm3u8';

    if (!baseUrl || !user || !pass) {
      setSettingsStatus('Please enter Xtream Server URL, Username, and Password.', 'error');
      return;
    }

    const existing = state.sources.find((s) => s.id === state.replacingSourceId) ||
      state.sources.find((s) => s.type === 'xtream' && s.xtream && s.xtream.url === baseUrl && s.xtream.user === user);
    const sourceId = existing ? existing.id : `src_xtream_${Date.now()}`;
    const isReplacing = Boolean(state.replacingSourceId);

    setSettingsStatus('Authenticating & fetching live channels, VOD, and series...', 'info');
    try {
      const { channels, vodItems, seriesItems } = await fetchAndParseXtream(baseUrl, user, pass, fmt, sourceId);

      state.vodItems = vodItems;
      state.seriesItems = seriesItems;
      await Promise.all([dbSet('vodItems', vodItems), dbSet('seriesItems', seriesItems)]);

      localStorage.setItem(STORAGE_KEYS.XTREAM_CREDS, JSON.stringify({
        url: baseUrl,
        user,
        pass,
        format: fmt
      }));

      // Auto-populate and fetch Xtream XMLTV EPG
      const xtreamEpg = `${baseUrl}/xmltv.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
      el.epgUrlInput.value = xtreamEpg;

      await mergeSourceChannels(sourceId, channels, 'Xtream Codes', { teardownIfPlaying: isReplacing });
      upsertSource({
        id: sourceId,
        type: 'xtream',
        label: `${user}@${baseUrl}`,
        xtream: { url: baseUrl, user, pass, format: fmt },
        epgUrl: xtreamEpg,
        channelCount: channels.length,
        updatedAt: Date.now()
      });
      state.replacingSourceId = '';
      setSettingsStatus(`Connected! Loaded ${channels.length.toLocaleString()} live, ${vodItems.length.toLocaleString()} VOD, ${seriesItems.length.toLocaleString()} series.`, 'success');
      closeSettings();
      loadEpgCascade([xtreamEpg], { sourceLabel: 'Xtream XMLTV' }).catch(() => {});
      loadEpgFromUrl(xtreamEpg, { silent: true, sourceLabel: 'Xtream XMLTV' });
    } catch (err) {
      setSettingsStatus(`Xtream error: ${err.message}`, 'error');
    }
  }

  function pruneEpgMapWindow(epgMap) {
    if (!epgMap || typeof epgMap !== 'object') {
      return { epgMap: Object.create(null), channelCount: 0, programCount: 0 };
    }
    const nowMs = Date.now();
    const minMs = nowMs - (7 * 86400000);
    const maxMs = nowMs + (7 * 86400000);
    const pruned = Object.create(null);
    let channelCount = 0;
    let programCount = 0;
    for (const key of Object.keys(epgMap)) {
      const list = epgMap[key];
      if (!Array.isArray(list) || !list.length) continue;
      const filtered = list.filter((p) => p && Number(p.stop || p.end || 0) >= minMs && Number(p.start || 0) <= maxMs);
      if (filtered.length > 0) {
        pruned[key] = filtered;
        channelCount++;
        programCount += filtered.length;
      }
    }
    return { epgMap: pruned, channelCount, programCount };
  }

  async function applyEpgData(parsed, sourceLabel, options = {}) {
    const windowed = pruneEpgMapWindow(parsed && parsed.epgMap);
    state.epgMap = windowed.epgMap;
    state.epgChannelCount = windowed.channelCount;
    state.epgProgramCount = windowed.programCount;
    state.epgChannelNames = (parsed && parsed.channelNames) ? parsed.channelNames : null;
    state.epgLastUpdatedMs = Date.now();
    buildEpgLookupIndex(state.epgMap, state.epgChannelNames);
    if (parsed && typeof parsed === 'object') parsed.epgMap = null;
    const summaryMsg = `Loaded ${state.epgProgramCount.toLocaleString()} programs across ${state.epgChannelCount.toLocaleString()} channels (${sourceLabel}).`;
    el.epgSummaryText.textContent = summaryMsg;
    const modalStatusEl = document.getElementById('epgModalStatusText');
    if (modalStatusEl) modalStatusEl.textContent = `TV Guide: ${state.epgProgramCount.toLocaleString()} programs across ${state.epgChannelCount.toLocaleString()} channels`;

    await dbSet('epg', {
      epgMap: state.epgMap,
      channelNames: state.epgChannelNames,
      channelCount: state.epgChannelCount,
      programCount: state.epgProgramCount,
      sourceLabel,
      updatedAt: state.epgLastUpdatedMs
    });

    updateOsd();
    filterAndRenderChannels();
    if (!el.epgOverlay.classList.contains('hidden')) {
      renderEpgGrid();
    }
    if (el.channelGuideModal && !el.channelGuideModal.classList.contains('hidden')) {
      renderChannelGuide();
    }
    if (!options.silent) {
      showToast(`TV Guide updated (${state.epgProgramCount.toLocaleString()} programs)`);
    } else if (options.toastOnUpdate) {
      showToast('TV Guide updated', 2600);
    }
  }

  async function decodeXmltvResponseBuffer(arrayBuf) {
    const bytes = new Uint8Array(arrayBuf);
    // Decompress gzipped XMLTV feeds (.xml.gz) using native DecompressionStream when available
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b && typeof DecompressionStream === 'function') {
      try {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = new Blob([arrayBuf]).stream().pipeThrough(ds);
        const decompressedBuf = await new Response(decompressedStream).arrayBuffer();
        return decodeUtf8Buffer(decompressedBuf);
      } catch (gzErr) {
        console.warn('Gzip XMLTV decompression failed, falling back to raw decode:', gzErr.message);
      }
    }
    return decodeUtf8Buffer(arrayBuf);
  }

  async function loadAutoEpgUrls(urls, sourceLabel = 'M3U Auto-EPG') {
    const list = (Array.isArray(urls) ? urls : [urls]).map((u) => String(u || '').trim()).filter(Boolean);
    for (let i = 0; i < list.length; i++) {
      const ok = await loadEpgFromUrl(list[i], { silent: true, sourceLabel });
      if (ok) {
        if (!el.epgUrlInput.value.trim()) el.epgUrlInput.value = list[i];
        return true;
      }
    }
    return false;
  }

  async function loadEpgFromUrl(url, options = {}) {
    const cleanUrl = url.trim();
    const silent = Boolean(options.silent);
    if (!cleanUrl) {
      if (!silent) setSettingsStatus('Please enter a valid XMLTV EPG URL.', 'error');
      return false;
    }
    if (!silent) {
      setSettingsStatus('Downloading & indexing XMLTV EPG in background...', 'info');
    }
    try {
      const timeoutMs = options.timeoutMs || 45000;
      let resp = null;
      if (/^https?:\/\//i.test(cleanUrl)) {
        const epgEndpoint = `${window.location.origin}/epg/fetch?url=${encodeURIComponent(cleanUrl)}`;
        try {
          resp = await fetchWithTimeout(epgEndpoint, { cache: 'no-store' }, timeoutMs);
        } catch (_) {
          resp = null;
        }
        if (!resp || (!resp.ok && resp.status === 404)) {
          resp = await fetchWithTimeout(cleanUrl, { cache: 'no-store' }, timeoutMs);
        }
      } else {
        resp = await fetchWithTimeout(buildUrl(cleanUrl), { cache: 'no-store' }, timeoutMs);
      }
      if (!resp.ok) {
        let errDetail = `HTTP ${resp.status}`;
        try {
          const errJson = await resp.clone().json();
          if (errJson && errJson.error) errDetail = errJson.error;
        } catch (_) {}
        throw new Error(errDetail);
      }
      const text = await decodeXmltvResponseBuffer(await resp.arrayBuffer());
      const parsed = await runWorkerTask('parseXmltv', { xmlText: text });
      state.epgLastError = '';
      const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
      meta.epgUrl = cleanUrl;
      localStorage.setItem(STORAGE_KEYS.PLAYLIST_META, JSON.stringify(meta));
      await applyEpgData(parsed, options.sourceLabel || 'XMLTV URL', { silent, toastOnUpdate: Boolean(options.toastOnUpdate) });
      if (!silent) {
        setSettingsStatus(`EPG loaded: ${parsed.programCount.toLocaleString()} programs.`, 'success');
      }
      return true;
    } catch (err) {
      state.epgLastError = `EPG error (${cleanUrl}): ${err.message}`;
      const modalStatusEl = document.getElementById('epgModalStatusText');
      if (modalStatusEl && state.epgProgramCount === 0) {
        modalStatusEl.textContent = state.epgLastError;
      }
      if (!silent) {
        setSettingsStatus(`Failed to load EPG URL: ${err.message}`, 'error');
      } else {
        console.warn('Auto EPG load skipped:', err.message);
      }
      return false;
    }
  }

  async function refreshActiveSourcesInBackground() {
    if (state.isBackgroundRefreshing) return;
    state.isBackgroundRefreshing = true;

    let playlistUpdated = false;
    let epgUpdated = false;

    try {
      const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
      const rawXtream = localStorage.getItem(STORAGE_KEYS.XTREAM_CREDS);
      let explicitEpgUrl = (meta.epgUrl || el.epgUrlInput.value || '').trim();

      if (rawXtream) {
        const x = JSON.parse(rawXtream);
        const baseUrl = (x.url || '').trim().replace(/\/+$/, '');
        if (baseUrl && x.user && x.pass) {
          try {
            const { channels, vodItems, seriesItems } = await fetchAndParseXtream(
              baseUrl,
              x.user,
              x.pass,
              x.format || 'm3u8'
            );
            state.vodItems = vodItems;
            state.seriesItems = seriesItems;
            await Promise.all([dbSet('vodItems', vodItems), dbSet('seriesItems', seriesItems)]);
            if (channels.length > 0) {
              await applyChannels(channels, 'Xtream Codes', { silentRefresh: true });
              playlistUpdated = true;
            }
            if (!explicitEpgUrl) {
              explicitEpgUrl = `${baseUrl}/xmltv.php?username=${encodeURIComponent(x.user)}&password=${encodeURIComponent(x.pass)}`;
            }
          } catch (err) {
            console.warn('Background Xtream refresh failed:', err.message);
          }
        }
      } else if (meta.m3uUrl || meta.localM3uPath || el.m3uUrlInput.value.trim()) {
        const localPath = (meta.localM3uPath || '').trim();
        const remoteUrl = (meta.m3uUrl || el.m3uUrlInput.value || '').trim();
        const fetchTarget = localPath
          ? `/proxy?file=${encodeURIComponent(localPath)}`
          : buildPlaylistFetchUrl(remoteUrl, meta.m3uUserAgent || '');
        if (fetchTarget) {
          try {
            const resp = await fetch(fetchTarget);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = decodeUtf8Buffer(await resp.arrayBuffer());
            const res = await runWorkerTask('parseM3u', { text });
            const channels = res.channels || [];
            if (channels.length > 0) {
              await applyChannels(channels, localPath ? 'Local M3U' : 'M3U URL', { silentRefresh: true });
              playlistUpdated = true;
            }
            if (!explicitEpgUrl) {
              const list = Array.isArray(res.epgUrls) && res.epgUrls.length
                ? res.epgUrls
                : (res.epgUrl ? [res.epgUrl] : []);
              if (list.length) {
                epgUpdated = await loadAutoEpgUrls(list, 'Background Sync');
              }
            }
          } catch (err) {
            console.warn('Background M3U refresh failed:', err.message);
          }
        }
      }

      if (!epgUpdated && !explicitEpgUrl && Array.isArray(state.sources)) {
        const srcEpg = state.sources.find((s) => s && s.epgUrl);
        if (srcEpg && srcEpg.epgUrl) {
          explicitEpgUrl = srcEpg.epgUrl;
        }
      }

      if (!epgUpdated && explicitEpgUrl) {
        epgUpdated = await loadEpgFromUrl(explicitEpgUrl, {
          silent: true,
          sourceLabel: 'Background Sync'
        });
      }

      if (playlistUpdated || epgUpdated) {
        showToast('TV Guide updated', 2600);
      }
    } catch (err) {
      console.warn('Background startup refresh error:', err.message);
    } finally {
      state.isBackgroundRefreshing = false;
    }
  }

  async function loadEpgCascade(candidateUrls = [], options = {}) {
    const candidates = [];
    const pushCandidate = (u) => {
      const s = String(u || '').trim();
      if (s && !candidates.includes(s)) candidates.push(s);
    };

    (Array.isArray(candidateUrls) ? candidateUrls : [candidateUrls]).forEach(pushCandidate);
    try {
      const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
      pushCandidate(state.settings && state.settings.epgUrl);
      pushCandidate(meta.epgUrl);
      if (el.epgUrlInput) pushCandidate(el.epgUrlInput.value);
      if (Array.isArray(state.sources)) {
        for (let i = 0; i < state.sources.length; i++) {
          if (state.sources[i] && state.sources[i].epgUrl) pushCandidate(state.sources[i].epgUrl);
        }
      }
      const rawXtream = localStorage.getItem(STORAGE_KEYS.XTREAM_CREDS);
      if (rawXtream) {
        const x = JSON.parse(rawXtream);
        const base = (x.url || '').trim().replace(/\/+$/, '');
        if (base && x.user && x.pass) {
          pushCandidate(`${base}/xmltv.php?username=${encodeURIComponent(x.user)}&password=${encodeURIComponent(x.pass)}`);
        }
      }
      if (Array.isArray(options.extraEpgUrls)) {
        options.extraEpgUrls.forEach(pushCandidate);
      }
      if (Array.isArray(meta.autoEpgUrls)) {
        meta.autoEpgUrls.forEach(pushCandidate);
      }
    } catch (_) {}

    for (let i = 0; i < candidates.length; i++) {
      const ok = await loadEpgFromUrl(candidates[i], {
        silent: true,
        toastOnUpdate: true,
        timeoutMs: 25000,
        sourceLabel: options.sourceLabel || 'TV Guide'
      });
      if (ok) return true;
    }
    return false;
  }

  async function refreshEpgCascade(options = {}) {
    return loadEpgCascade(options.extraEpgUrls || [], options);
  }

  async function refreshStartupPlaylistAndEpg(forceRefresh = false) {
    if (state.isStartupRefreshing) return;
    state.isStartupRefreshing = true;
    const extraEpgUrls = [];

    try {
      const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
      const rawXtream = localStorage.getItem(STORAGE_KEYS.XTREAM_CREDS);
      const localPath = (meta.localM3uPath || '').trim();
      const remoteUrl = (meta.m3uUrl || (el.m3uUrlInput ? el.m3uUrlInput.value : '') || '').trim();

      if (rawXtream) {
        try {
          const x = JSON.parse(rawXtream);
          const baseUrl = (x.url || '').trim().replace(/\/+$/, '');
          if (baseUrl && x.user && x.pass) {
            const { channels, vodItems, seriesItems } = await fetchAndParseXtream(baseUrl, x.user, x.pass, x.format || 'm3u8');
            state.vodItems = vodItems;
            state.seriesItems = seriesItems;
            await Promise.all([dbSet('vodItems', vodItems), dbSet('seriesItems', seriesItems)]);
            if (channels.length > 0) {
              await applyChannels(channels, 'Xtream Codes', { silentRefresh: true });
            }
          }
        } catch (err) {
          console.warn('Startup Xtream refresh failed:', err.message);
        }
      } else if (remoteUrl || localPath) {
        const fetchTarget = localPath
          ? `/netshare/stream?path=${encodeURIComponent(localPath)}`
          : buildPlaylistFetchUrl(remoteUrl, meta.m3uUserAgent || '');
        if (fetchTarget) {
          try {
            const resp = await fetchWithTimeout(fetchTarget, { cache: 'no-store' }, 25000);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = decodeUtf8Buffer(await resp.arrayBuffer());
            const res = await runWorkerTask('parseM3u', { text });
            if (Array.isArray(res.epgUrls) && res.epgUrls.length) {
              extraEpgUrls.push(...res.epgUrls);
              meta.autoEpgUrls = res.epgUrls;
              localStorage.setItem(STORAGE_KEYS.PLAYLIST_META, JSON.stringify(meta));
            } else if (res.epgUrl) {
              extraEpgUrls.push(res.epgUrl);
            }
            if (Array.isArray(res.channels) && res.channels.length > 0) {
              await applyChannels(res.channels, localPath ? 'Local M3U' : 'M3U URL', { silentRefresh: true });
            }
          } catch (err) {
            console.warn('Startup playlist refresh failed:', err.message);
          }
        }
      } else if (!Array.isArray(state.channels) || state.channels.length === 0) {
        // Fresh installation: keep state.channels empty and show clean Setup empty-state prompt
        return;
      }

      const hasConfiguredSource = Boolean(rawXtream || remoteUrl || localPath || (state.settings && state.settings.epgUrl) || meta.epgUrl || extraEpgUrls.length);
      if (!hasConfiguredSource) return;

      const isEpgStale = forceRefresh ||
        !state.epgMap ||
        Object.keys(state.epgMap).length === 0 ||
        (Date.now() - (state.epgLastUpdatedMs || 0)) > 2 * 60 * 60 * 1000;
      if (isEpgStale) {
        await refreshEpgCascade({ extraEpgUrls, sourceLabel: 'Startup EPG' });
      }
    } finally {
      state.isStartupRefreshing = false;
    }
  }

  async function loadEpgFromFile(file) {
    if (!file) return;
    setSettingsStatus(`Indexing ${file.name} in background...`, 'info');
    try {
      const text = decodeUtf8Buffer(await file.arrayBuffer());
      const parsed = await runWorkerTask('parseXmltv', { xmlText: text });
      await applyEpgData(parsed, file.name);
      setSettingsStatus(`EPG loaded from ${file.name}.`, 'success');
    } catch (err) {
      setSettingsStatus(`Failed to parse XMLTV file: ${err.message}`, 'error');
    }
  }

  // Strict Single-Stream Guard & Native D3D11 libmpv WebView2 Bridge
  function isMpvHost() {
    return Boolean(window.chrome && window.chrome.webview);
  }

  function postMpvCommand(cmd, payload = {}) {
    if (!window.chrome || !window.chrome.webview) return false;
    try {
      const mappedCmd = cmd === 'mpv:fullscreen' ? 'app:fullscreen' : cmd;
      const msg = { type: mappedCmd, cmd: mappedCmd, ...payload };
      window.chrome.webview.postMessage(msg);
      return true;
    } catch (_) {
      return false;
    }
  }

  function notifyHostPowerMode(sleep) {
    if (!isMpvHost()) return;
    const isPlaying = Boolean(state.mpvActive && state.mpvPlayingConfirmed && !state.mpvPaused && !state.mpvErrorOccurred);
    const osdHidden = Boolean(el.playerStage && el.playerStage.classList.contains('osd-hidden'));
    const loadingDone = Boolean(
      (el.loadingOverlay && el.loadingOverlay.classList.contains('hidden')) ||
      (document.body && document.body.classList.contains('mpv-playing'))
    );
    const shouldSleep = Boolean(sleep) && isPlaying && osdHidden && loadingDone && !isAnyOverlayOpen();
    if (shouldSleep === state.hostPowerSleep) return;
    state.hostPowerSleep = shouldSleep;
    postMpvCommand('mpv:power-mode', { sleep: shouldSleep });
  }

  function setMpvVisualActive(active) {
    state.mpvActive = Boolean(active);
    ['vlc-active', 'mpv-active'].forEach((cls) => {
      document.documentElement.classList.toggle(cls, state.mpvActive);
      document.body.classList.toggle(cls, state.mpvActive);
      const appRoot = document.getElementById('app');
      if (appRoot) appRoot.classList.toggle(cls, state.mpvActive);
      if (el.playerStage) el.playerStage.classList.toggle(cls, state.mpvActive);
    });
    if (!state.mpvActive) {
      setMpvPlayingOverlayHidden(false);
    }
  }

  function setMpvPlayingOverlayHidden(playing) {
    const isPlaying = Boolean(playing);
    document.documentElement.classList.toggle('vlc-playing', isPlaying);
    document.body.classList.toggle('vlc-playing', isPlaying);
    document.documentElement.classList.toggle('mpv-playing', isPlaying);
    document.body.classList.toggle('mpv-playing', isPlaying);
    if (isPlaying) {
      el.emptyOverlay.classList.add('hidden');
      hideBufferingOverlay();
      if (typeof state.pauseTacticalFx === 'function') state.pauseTacticalFx();
      if (el.playerStage && el.playerStage.classList.contains('osd-hidden') && !isAnyOverlayOpen()) {
        notifyHostPowerMode(true);
      }
    } else {
      notifyHostPowerMode(false);
    }
  }

  function syncMpvTrackSelectors(tracks) {
    if (!Array.isArray(tracks)) return;
    const audioTracks = tracks.filter((t) => t && t.type === 'audio');
    const subTracks = tracks.filter((t) => t && t.type === 'sub');
    if (audioTracks.length > 0 && el.osdAudioSelect) {
      el.osdAudioSelect.innerHTML = '';
      audioTracks.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = String(t.id);
        opt.textContent = `Audio: ${t.title || t.lang || ('Track ' + t.id)}`;
        if (t.selected) opt.selected = true;
        el.osdAudioSelect.appendChild(opt);
      });
    }
    if (el.osdSubSelect) {
      el.osdSubSelect.innerHTML = '<option value="no">Subtitles: Off</option>';
      subTracks.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = String(t.id);
        opt.textContent = `CC: ${t.title || t.lang || ('Track ' + t.id)}`;
        if (t.selected) opt.selected = true;
        el.osdSubSelect.appendChild(opt);
      });
    }
  }

  function initMpvBridge() {
    if (!isMpvHost() || state.mpvBridgeInitialized) return;
    state.mpvBridgeInitialized = true;
    window.chrome.webview.addEventListener('message', (event) => {
      const msg = event && event.data;
      if (!msg) return;
      if (msg.type === 'ui:wake') {
        state.hostPowerSleep = false;
        showOsd();
        return;
      }
      if (msg.type === 'mpv:ready') {
        if (!state.isMpvPlaying && state.lastPendingPlayArgs && state.lastPendingPlayArgs.url) {
          postMpvCommand('mpv:load', state.lastPendingPlayArgs);
        }
        return;
      }
      if ((msg.type !== 'mpv:status' && msg.type !== 'vlc:status') || !state.mpvActive) return;

      if ((typeof msg.timePos === 'number' && Number.isFinite(msg.timePos)) || msg.event === 'mpv:time-pos') {
        if (typeof msg.timePos === 'number' && Number.isFinite(msg.timePos)) {
          state.mpvPosition = msg.timePos;
          if (state.pendingCatchupSeek && Math.abs(msg.timePos - state.pendingCatchupSeek.streamTarget) <= 15) {
            clearTimeout(state.pendingCatchupSeek.timer);
            state.pendingCatchupSeek = null;
          }
        }
        if (state.mpvPosition > 0 || msg.event === 'mpv:time-pos') {
          state.mpvPlayingConfirmed = true;
          state.isMpvPlaying = true;
          state.lastPendingPlayArgs = null;
          state.isMpvPlaying = false;
    state.mpvPaused = false;
          setMpvPlayingOverlayHidden(true);
          if (!state.mpvRecentRecorded && state.currentChannel) {
            state.mpvRecentRecorded = true;
            recordRecentWatch(state.currentChannel);
          }
        }
        updateSeekUi();
      }
      if (typeof msg.duration === 'number' && Number.isFinite(msg.duration)) {
        state.mpvDuration = msg.duration;
        updateSeekUi();
      }
      if (typeof msg.paused === 'boolean') {
        state.mpvPaused = msg.paused;
        updateOsd();
      }
      if (Array.isArray(msg.tracks)) {
        state.mpvTracks = msg.tracks;
        syncMpvTrackSelectors(msg.tracks);
      }
      if (
        msg.event === 'loaded' ||
        msg.event === 'playing' ||
        msg.event === 'mpv:load-ok' ||
        msg.event === 'mpv:start-file' ||
        msg.event === 'mpv:file-loaded' ||
        msg.event === 'mpv:video-reconfig' ||
        msg.event === 'mpv:playback-restart' ||
        msg.event === 'mpv:playing' ||
        msg.playing === true
      ) {
        state.reconnectAttempts = 0;
        state.mpvPlayingConfirmed = true;
        if (msg.event === 'mpv:file-loaded' || msg.event === 'mpv:video-reconfig' || msg.event === 'mpv:playback-restart' || msg.event === 'mpv:playing') {
          state.isMpvPlaying = true;
          state.lastPendingPlayArgs = null;
          state.catchupRetryQueue = [];
          state.catchupRetryContext = null;
          state.mpvDirectRetry = null;
        }
        if (msg.event === 'mpv:playing' || msg.event === 'mpv:playback-restart' || msg.event === 'mpv:video-reconfig' || msg.event === 'playing') {
          state.isMpvPlaying = false;
    state.mpvPaused = false;
        }
        setMpvPlayingOverlayHidden(true);
        if (!state.mpvRecentRecorded && state.currentChannel && msg.event !== 'mpv:start-file' && msg.event !== 'mpv:load-ok') {
          state.mpvRecentRecorded = true;
          recordRecentWatch(state.currentChannel);
        }
        updateOsd();
        updateSeekUi();
      } else if (msg.event === 'buffering') {
        if (!state.mpvPlayingConfirmed) {
          showBufferingOverlay();
        }
      } else if (msg.event === 'error' || msg.event === 'mpv:error') {
        if (state.pendingCatchupSeek) {
          const pendingTargetSec = state.pendingCatchupSeek.targetSec;
          clearTimeout(state.pendingCatchupSeek.timer);
          state.pendingCatchupSeek = null;
          if (state.currentCatchupProgram) {
            reseekCatchupFromOffset(pendingTargetSec);
            return;
          }
        }
        if (state.mpvDirectRetry && state.mpvDirectRetry.channel && state.mpvDirectRetry.targetUrl) {
          const retry = state.mpvDirectRetry;
          state.mpvDirectRetry = null;
          playChannel(retry.channel, {
            ...retry.options,
            overrideUrl: retry.targetUrl,
            forceProxyMpv: Boolean(retry.forceProxy),
            mpvProxyRetried: true
          });
          return;
        }
        if (state.currentCatchupProgram && Array.isArray(state.catchupRetryQueue) && state.catchupRetryQueue.length > 0 && state.catchupRetryContext) {
          const nextUrl = state.catchupRetryQueue.shift();
          const ctx = state.catchupRetryContext;
          if (nextUrl && ctx && ctx.channel && ctx.program) {
            state.lastCatchupUrl = nextUrl;
            playChannel(
              { ...ctx.channel, url: nextUrl },
              {
                overrideUrl: nextUrl,
                isCatchup: true,
                isCatchupFallback: true,
                programTitle: ctx.program.title,
                programStart: ctx.program.start,
                programStop: ctx.program.stop || ctx.program.end
              }
            );
            return;
          }
        }
        state.isMpvPlaying = false;
        state.mpvErrorOccurred = true;
        setMpvPlayingOverlayHidden(false);
        const errDetail = msg.error || 'Unable to open media';
        el.loadingText.textContent = state.currentCatchupProgram
          ? `Catch-up error: ${errDetail}`
          : `MPV playback error: ${errDetail}`;
        el.loadingOverlay.style.display = '';
        el.loadingOverlay.classList.remove('hidden');
        showToast(errDetail, 4000);
      } else if (msg.event === 'eof') {
        state.mpvPaused = true;
        updateOsd();
      }
    });
  }

  function teardownActiveStream() {
    state.playGeneration++;
    notifyHostPowerMode(false);
    if (state.mpvActive) {
      postMpvCommand('mpv:stop');
      setMpvVisualActive(false);
    }
    state.isMpvPlaying = false;
    state.mpvPaused = false;
    state.mpvPosition = 0;
    state.mpvDuration = 0;
    state.mpvTracks = [];
    if (state.pendingCatchupSeek && state.pendingCatchupSeek.timer) {
      clearTimeout(state.pendingCatchupSeek.timer);
    }
    state.pendingCatchupSeek = null;
    state.mpvDirectRetry = null;
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
    clearTimeout(state.startupRetryTimer);
    state.startupRetryTimer = null;
    clearTimeout(state.videoCheckTimer);
    state.videoCheckTimer = null;
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      stopDvrRecording();
    }
    if (state.hls) {
      try {
        state.hls.stopLoad();
        state.hls.detachMedia();
        state.hls.destroy();
      } catch (err) {
        console.warn('HLS teardown error:', err);
      }
      state.hls = null;
    }
    try {
      el.video.onerror = null;
      el.video.onloadedmetadata = null;
      el.video.pause();
      el.video.removeAttribute('src');
      el.video.src = '';
      el.video.load();
      if (isMpvHost()) {
        el.video.style.display = 'none';
      }
    } catch (err) {
      console.warn('Video reset error:', err);
    }
    state.lastBitrateKbps = 0;
    state.measuredFps = 0;
    state.lastFrameCount = 0;
    state.lastFrameTime = 0;
    clearExternalSubtitle();
    resetTrackSelectors();
  }

  // External Subtitles (.srt / .vtt) & Sync Offset
  function clearExternalSubtitle() {
    if (state.extSubTrackEl) {
      state.extSubTrackEl.remove();
      state.extSubTrackEl = null;
    }
    if (state.extSubBlobUrl) {
      URL.revokeObjectURL(state.extSubBlobUrl);
      state.extSubBlobUrl = '';
    }
    state.extSubBaseCues = [];
    state.subOffsetMs = 0;
    el.osdSubDelayMinusBtn.classList.add('hidden');
    el.osdSubDelayLabel.classList.add('hidden');
    el.osdSubDelayPlusBtn.classList.add('hidden');
  }

  function convertSrtToVtt(srtText) {
    const clean = (srtText || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = clean.split(/\n{2,}/);
    const out = ['WEBVTT', ''];
    for (let i = 0; i < blocks.length; i++) {
      const lines = blocks[i].split('\n').filter((l) => l.trim() !== '');
      if (!lines.length) continue;
      let idx = 0;
      if (/^\d+$/.test(lines[0].trim()) && lines.length > 1) idx = 1;
      const timeLine = lines[idx].replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      if (!timeLine.includes('-->')) continue;
      out.push(timeLine);
      for (let j = idx + 1; j < lines.length; j++) {
        out.push(lines[j]);
      }
      out.push('');
    }
    return out.join('\n');
  }

  async function loadExternalSubtitleFile(file) {
    if (!file) return;
    try {
      const raw = await file.text();
      const isSrt = /\.srt$/i.test(file.name);
      const vttText = isSrt ? convertSrtToVtt(raw) : raw.replace(/^\uFEFF/, '');
      clearExternalSubtitle();

      const blob = new Blob([vttText], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      state.extSubBlobUrl = blobUrl;

      const trackEl = document.createElement('track');
      trackEl.kind = 'subtitles';
      trackEl.label = `External: ${file.name}`;
      trackEl.srclang = 'en';
      trackEl.src = blobUrl;
      trackEl.default = true;
      el.video.appendChild(trackEl);
      state.extSubTrackEl = trackEl;

      trackEl.addEventListener('load', () => {
        const tt = trackEl.track;
        if (!tt) return;
        tt.mode = 'showing';
        state.extSubBaseCues = [];
        if (tt.cues) {
          for (let i = 0; i < tt.cues.length; i++) {
            state.extSubBaseCues.push({
              start: tt.cues[i].startTime,
              end: tt.cues[i].endTime
            });
          }
        }
        syncTrackSelectors();
        el.osdSubDelayMinusBtn.classList.remove('hidden');
        el.osdSubDelayLabel.classList.remove('hidden');
        el.osdSubDelayPlusBtn.classList.remove('hidden');
        el.osdSubDelayLabel.textContent = '0ms';
        showToast(`Loaded subtitle: ${file.name}`);
      });
    } catch (err) {
      showToast(`Subtitle error: ${err.message}`);
    }
  }

  function adjustSubtitleOffset(deltaMs) {
    if (!state.extSubTrackEl || !state.extSubTrackEl.track || !state.extSubTrackEl.track.cues) return;
    state.subOffsetMs += deltaMs;
    const offsetSec = state.subOffsetMs / 1000;
    const cues = state.extSubTrackEl.track.cues;
    for (let i = 0; i < cues.length && i < state.extSubBaseCues.length; i++) {
      const base = state.extSubBaseCues[i];
      cues[i].startTime = Math.max(0, base.start + offsetSec);
      cues[i].endTime = Math.max(0.05, base.end + offsetSec);
    }
    const sign = state.subOffsetMs > 0 ? '+' : '';
    el.osdSubDelayLabel.textContent = `${sign}${state.subOffsetMs}ms`;
    showOsd();
  }

  // Local Live-Stream DVR Recording (captures active <video> without a second server connection)
  function startDvrRecording() {
    if (!state.currentChannel || el.video.readyState < 2) {
      showToast('Start playing a live stream before recording');
      return;
    }
    const captureFn = el.video.captureStream || el.video.mozCaptureStream;
    if (!captureFn || typeof window.MediaRecorder === 'undefined') {
      showToast('Local DVR recording is not supported in this browser');
      return;
    }

    try {
      const stream = captureFn.call(el.video);
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      const mimeType = candidates.find((m) => window.MediaRecorder.isTypeSupported(m)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      state.recordedChunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
      };
      recorder.onstop = () => {
        if (!state.recordedChunks.length) return;
        const type = recorder.mimeType || 'video/webm';
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(state.recordedChunks, { type });
        state.recordedChunks = [];
        const safeName = (state.currentChannel ? state.currentChannel.name : 'recording').replace(/[^a-zA-Z0-9_-]/g, '_');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}-${stamp}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast(`Saved DVR recording (${ext.toUpperCase()})`);
      };

      recorder.start(1000);
      state.mediaRecorder = recorder;
      state.recStartMs = Date.now();
      el.recIndicator.classList.remove('hidden');
      el.osdRecordBtn.classList.add('is-recording');
      el.osdRecordBtn.textContent = 'Stop Rec';
      clearInterval(state.recTimer);
      state.recTimer = setInterval(() => {
        const secs = Math.floor((Date.now() - state.recStartMs) / 1000);
        const m = String(Math.floor(secs / 60)).padStart(2, '0');
        const s = String(secs % 60).padStart(2, '0');
        el.recTimerText.textContent = `REC ${m}:${s}`;
      }, 1000);
      el.recTimerText.textContent = 'REC 00:00';
      showToast('DVR recording started');
    } catch (err) {
      showToast(`Recording error: ${err.message}`);
    }
  }

  function stopDvrRecording() {
    clearInterval(state.recTimer);
    state.recTimer = null;
    el.recIndicator.classList.add('hidden');
    el.osdRecordBtn.classList.remove('is-recording');
    el.osdRecordBtn.textContent = 'Record';
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      try {
        state.mediaRecorder.stop();
      } catch (err) {
        console.warn('Recorder stop error:', err);
      }
    }
    state.mediaRecorder = null;
  }

  function toggleDvrRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      stopDvrRecording();
    } else {
      startDvrRecording();
    }
  }

  // Real-Time Stream Diagnostics OSD
  function toggleDiagnostics() {
    state.diagnosticsVisible = !state.diagnosticsVisible;
    el.diagnosticsPanel.classList.toggle('hidden', !state.diagnosticsVisible);
    el.osdStatsBtn.classList.toggle('is-active', state.diagnosticsVisible);
    if (state.diagnosticsVisible) updateDiagnostics();
  }

  function updateDiagnostics() {
    if (!state.diagnosticsVisible || isTypingInSetupForm()) return;
    const v = el.video;
    el.diagConn.textContent = state.reconnectTimer
      ? `Reconnecting (${state.reconnectAttempts}/4)`
      : (state.currentChannel ? (v.paused ? 'Paused (1 Stream)' : '1 Active Stream') : 'Idle');
    el.diagRes.textContent = v.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : '--';

    let kbps = state.lastBitrateKbps;
    if (state.hls && state.hls.levels && state.hls.currentLevel >= 0) {
      const lvl = state.hls.levels[state.hls.currentLevel];
      if (lvl && lvl.bitrate) kbps = Math.round(lvl.bitrate / 1000);
    }
    el.diagBitrate.textContent = kbps ? `${(kbps / 1000).toFixed(2)} Mbps` : '--';

    let bufferSec = 0;
    if (v.buffered && v.buffered.length > 0) {
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) >= v.currentTime) {
          bufferSec = Math.max(0, v.buffered.end(i) - v.currentTime);
          break;
        }
      }
    }
    el.diagBuffer.textContent = `${bufferSec.toFixed(1)}s`;

    if (typeof v.getVideoPlaybackQuality === 'function') {
      const q = v.getVideoPlaybackQuality();
      const now = performance.now();
      if (state.lastFrameTime > 0 && now > state.lastFrameTime) {
        const dt = (now - state.lastFrameTime) / 1000;
        const df = q.totalVideoFrames - state.lastFrameCount;
        if (dt >= 0.5 && df >= 0) state.measuredFps = Math.round(df / dt);
      }
      state.lastFrameCount = q.totalVideoFrames;
      state.lastFrameTime = now;
      el.diagFps.textContent = state.measuredFps ? `${state.measuredFps} fps` : '--';
      el.diagDropped.textContent = String(q.droppedVideoFrames || 0);
    } else {
      el.diagFps.textContent = '--';
      el.diagDropped.textContent = '0';
    }
  }

  // Single-Connection Automatic Recovery
  function scheduleReconnect() {
    if (!state.currentChannel || state.reconnectTimer || state.userPaused) return;
    if (state.reconnectAttempts >= 4) {
      el.loadingOverlay.classList.add('hidden');
      showToast(`Stream disconnected: ${state.currentChannel.name}`);
      return;
    }
    state.reconnectAttempts++;
    const delays = [1500, 3000, 6000, 10000];
    const waitMs = delays[state.reconnectAttempts - 1] || 10000;
    el.loadingText.textContent = `Reconnecting (${state.reconnectAttempts}/4)...`;
    el.loadingOverlay.style.display = '';
    el.loadingOverlay.classList.remove('hidden');

    const ch = state.currentChannel;
    const opts = { ...state.lastPlayOptions, isReconnect: true };
    teardownActiveStream();
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      playChannel(ch, opts);
    }, waitMs);
  }

  function resetTrackSelectors() {
    el.osdAudioSelect.innerHTML = '<option value="-1">Audio: Default</option>';
    el.osdSubSelect.innerHTML = '<option value="-1">CC: Off</option>';
  }

  function syncTrackSelectors() {
    resetTrackSelectors();
    if (state.hls) {
      const aTracks = state.hls.audioTracks || [];
      if (aTracks.length > 0) {
        el.osdAudioSelect.innerHTML = '';
        aTracks.forEach((t, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `Audio: ${t.name || t.lang || 'Track ' + (idx + 1)}`;
          if (idx === state.hls.audioTrack) opt.selected = true;
          el.osdAudioSelect.appendChild(opt);
        });
      }

      const sTracks = state.hls.subtitleTracks || [];
      if (sTracks.length > 0) {
        sTracks.forEach((t, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `CC: ${t.name || t.lang || 'Sub ' + (idx + 1)}`;
          if (idx === state.hls.subtitleTrack) opt.selected = true;
          el.osdSubSelect.appendChild(opt);
        });
      }
    }
    if (el.video.textTracks && el.video.textTracks.length > 0) {
      for (let i = 0; i < el.video.textTracks.length; i++) {
        const tt = el.video.textTracks[i];
        if (state.hls && !String(tt.label || '').startsWith('External:')) continue;
        const opt = document.createElement('option');
        opt.value = `ext_${i}`;
        opt.textContent = `CC: ${tt.label || tt.language || 'Track ' + (i + 1)}`;
        if (tt.mode === 'showing') opt.selected = true;
        el.osdSubSelect.appendChild(opt);
      }
    }
  }

  function cycleAspectRatio() {
    state.aspectIndex = (state.aspectIndex + 1) % ASPECT_MODES.length;
    const mode = ASPECT_MODES[state.aspectIndex];
    el.video.style.objectFit = mode;
    el.osdAspectBtn.innerHTML = `${OSD_ICONS.aspect}<span>Fit: ${mode.charAt(0).toUpperCase() + mode.slice(1)}</span>`;
    showToast(`Aspect ratio: ${mode}`);
    showOsd();
  }

  function hasCatchupSupport(channel) {
    return Boolean(channel && (channel.catchupDays > 0 || channel.catchupSource || channel.catchupType));
  }

  function buildCatchupUrl(channel, program) {
    if (!channel || !program || !Number.isFinite(Number(program.start)) || Number(program.start) <= 0) return '';
    const stopMs = Number(program.stop || program.end || (program.start + 1800000));
    const startSec = Math.floor(program.start / 1000);
    const endSec = Math.floor(stopMs / 1000);
    const nowSec = Math.floor(Date.now() / 1000);
    const durSecs = Math.max(60, endSec - startSec);
    const durMins = Math.max(1, Math.ceil(durSecs / 60));
    const offsetSec = Math.max(0, nowSec - startSec);
    const d = new Date(program.start);
    const e = new Date(stopMs);
    const pad = (n) => String(n).padStart(2, '0');
    const xtStart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}:${pad(d.getHours())}-${pad(d.getMinutes())}`;

    // 1. Xtream Codes timeshift archive
    if (channel.streamId) {
      let xCreds = null;
      if (channel.sourceId && Array.isArray(state.sources)) {
        const src = state.sources.find((s) => s && s.id === channel.sourceId && s.xtream);
        if (src && src.xtream) xCreds = src.xtream;
      }
      if (!xCreds) {
        try {
          const rawCreds = localStorage.getItem(STORAGE_KEYS.XTREAM_CREDS);
          if (rawCreds) xCreds = JSON.parse(rawCreds);
        } catch (_) {}
      }
      if (xCreds) {
        const base = (xCreds.url || '').replace(/\/+$/, '');
        if (base && xCreds.user && xCreds.pass) {
          const ext = xCreds.format === 'm3u8' ? 'm3u8' : 'ts';
          return `${base}/timeshift/${encodeURIComponent(xCreds.user)}/${encodeURIComponent(xCreds.pass)}/${durMins}/${xtStart}/${channel.streamId}.${ext}`;
        }
      }
    }

    const applyTemplate = (tpl) => tpl
      .replace(/\{utc\}|\$\{start\}|\{start\}/g, String(startSec))
      .replace(/\{utcend\}|\$\{end\}|\{end\}/g, String(endSec))
      .replace(/\{lutc\}/g, String(nowSec))
      .replace(/\{duration\}|\$\{duration\}/g, String(durSecs))
      .replace(/\{offset\}|\$\{offset\}/g, String(offsetSec))
      .replace(/\$\{timestamp\}/g, String(startSec))
      .replace(/\{Y\}/g, String(d.getFullYear()))
      .replace(/\{m\}/g, pad(d.getMonth() + 1))
      .replace(/\{d\}/g, pad(d.getDate()))
      .replace(/\{H\}/g, pad(d.getHours()))
      .replace(/\{M\}/g, pad(d.getMinutes()))
      .replace(/\{S\}/g, pad(d.getSeconds()))
      .replace(/\$\{\(b\)yyyy\}/g, String(d.getFullYear()))
      .replace(/\$\{\(b\)MM\}/g, pad(d.getMonth() + 1))
      .replace(/\$\{\(b\)dd\}/g, pad(d.getDate()))
      .replace(/\$\{\(b\)HH\}/g, pad(d.getHours()))
      .replace(/\$\{\(b\)mm\}/g, pad(d.getMinutes()))
      .replace(/\$\{\(b\)ss\}/g, pad(d.getSeconds()))
      .replace(/\$\{\(e\)yyyy\}/g, String(e.getFullYear()))
      .replace(/\$\{\(e\)MM\}/g, pad(e.getMonth() + 1))
      .replace(/\$\{\(e\)dd\}/g, pad(e.getDate()))
      .replace(/\$\{\(e\)HH\}/g, pad(e.getHours()))
      .replace(/\$\{\(e\)mm\}/g, pad(e.getMinutes()))
      .replace(/\$\{\(e\)ss\}/g, pad(e.getSeconds()))
      .replace(/\$\{\(b\)timestamp\}/g, String(startSec))
      .replace(/\$\{\(e\)timestamp\}/g, String(endSec))
      .replace(/\$\{\(d\)minutes\}/g, String(durMins));

    const cType = (channel.catchupType || '').toLowerCase();

    // 2. Explicit catchup-source template (full URL or append query/path)
    if (channel.catchupSource) {
      const rendered = applyTemplate(channel.catchupSource.trim());
      if (/^https?:\/\//i.test(rendered)) {
        return rendered;
      }
      if (channel.url) {
        if (rendered.startsWith('?') || rendered.startsWith('&')) {
          const base = channel.url;
          return base.includes('?') ? `${base}&${rendered.replace(/^[?&]+/, '')}` : `${base}?${rendered.replace(/^[?&]+/, '')}`;
        }
        if (rendered.startsWith('/')) {
          try {
            return new URL(rendered, channel.url).toString();
          } catch (_) {}
        }
        return `${channel.url.replace(/\/+$/, '')}/${rendered.replace(/^\/+/, '')}`;
      }
    }

    // 3. Xtream-style M3U stream URLs without explicit streamId/catchupSource (e.g. http://host:8080/live/user/pass/1234.ts)
    if (hasCatchupSupport(channel) && channel.url && !channel.catchupSource) {
      const xtMatch = channel.url.match(/^(https?:\/\/[^/]+)\/(?:live\/)?([^/]+)\/([^/]+)\/(\d+)(?:\.(ts|m3u8))?(?:\?.*)?$/i);
      if (xtMatch && (cType === 'xc' || !cType.includes('flussonic'))) {
        const ext = (xtMatch[5] || 'ts').toLowerCase();
        return `${xtMatch[1]}/timeshift/${xtMatch[2]}/${xtMatch[3]}/${durMins}/${xtStart}/${xtMatch[4]}.${ext}`;
      }
    }

    // 4. Flussonic / fs / shift / append / xc / default modes without explicit template
    if (hasCatchupSupport(channel) && channel.url) {
      if (cType.includes('flussonic') || cType === 'fs' || /\/(index|mono)\.m3u8(\?|$)/i.test(channel.url)) {
        if (/\/index\.m3u8/i.test(channel.url)) {
          return channel.url.replace(/\/index\.m3u8/i, `/index-${startSec}-${durSecs}.m3u8`);
        }
        if (/\/mono\.m3u8/i.test(channel.url)) {
          return channel.url.replace(/\/mono\.m3u8/i, `/timeshift_abs-${startSec}.m3u8`);
        }
        if (/\/(mpegts|video\.m3u8|live)(\?|$)/i.test(channel.url)) {
          return channel.url.replace(/\/(mpegts|video\.m3u8|live)(?=\?|$)/i, `/archive-${startSec}-${durSecs}.m3u8`);
        }
      }
      const sep = channel.url.includes('?') ? '&' : '?';
      return `${channel.url}${sep}utc=${startSec}&lutc=${nowSec}`;
    }

    return '';
  }

  function buildCatchupCandidates(channel, program, clockOverride = null) {
    const candidates = [];
    const pushUnique = (u) => {
      if (u && typeof u === 'string' && !candidates.includes(u)) candidates.push(u);
    };
    if (!channel || !program) return candidates;

    const stopMs = Number(program.stop || program.end || (program.start + 1800000));
    const baseStartSec = Math.floor(program.start / 1000);
    const baseEndSec = Math.floor(stopMs / 1000);
    const durSecs = Math.max(60, baseEndSec - baseStartSec);
    const durMins = Math.max(1, Math.ceil(durSecs / 60));

    const startSec = clockOverride && Number.isFinite(clockOverride.startSec) ? clockOverride.startSec : baseStartSec;
    const endSec = startSec + durSecs;
    const nowSec = clockOverride && Number.isFinite(clockOverride.nowSec) ? clockOverride.nowSec : Math.floor(Date.now() / 1000);
    const offsetSec = Math.max(0, nowSec - startSec);
    const offsetMin = Math.max(1, Math.ceil(offsetSec / 60));

    const adjProgram = clockOverride
      ? Object.assign({}, program, { start: startSec * 1000, stop: endSec * 1000, end: endSec * 1000 })
      : program;
    const primary = buildCatchupUrl(channel, adjProgram);
    pushUnique(primary);

    const d = new Date(startSec * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const xtStartLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}:${pad(d.getHours())}-${pad(d.getMinutes())}`;
    const xtStartUtc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}:${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`;

    // 1. Xtream /timeshift/ .ts & .m3u8 variants (local & UTC timestamps)
    if (primary && /\/timeshift\/.+\.(ts|m3u8)(\?|$)/i.test(primary)) {
      pushUnique(primary.replace(/\.ts(\?|$)/i, '.m3u8$1'));
      pushUnique(primary.replace(/\.m3u8(\?|$)/i, '.ts$1'));
    }

    if (channel.url) {
      let parsedUrl = null;
      try {
        parsedUrl = new URL(channel.url);
      } catch (_) {}

      if (parsedUrl) {
        // Xtream-style path extraction preserving origin & query tokens if any
        const xtMatch = parsedUrl.pathname.match(/^\/(?:live\/)?([^/]+)\/([^/]+)\/(\d+)(?:\.(ts|m3u8))?$/i);
        if (xtMatch) {
          for (const stamp of [xtStartLocal, xtStartUtc]) {
            pushUnique(`${parsedUrl.origin}/timeshift/${xtMatch[1]}/${xtMatch[2]}/${durMins}/${stamp}/${xtMatch[3]}.ts${parsedUrl.search}`);
            pushUnique(`${parsedUrl.origin}/timeshift/${xtMatch[1]}/${xtMatch[2]}/${durMins}/${stamp}/${xtMatch[3]}.m3u8${parsedUrl.search}`);
          }
        }

        // Helper to build sibling path URLs while preserving existing query tokens (e.g. ?token=xyz)
        const withSiblingPath = (newPath, extraParams = null) => {
          const u = new URL(parsedUrl.toString());
          u.pathname = newPath;
          if (extraParams) {
            for (const [k, v] of Object.entries(extraParams)) {
              u.searchParams.set(k, String(v));
            }
          }
          return u.toString();
        };

        const withQuery = (extraParams) => {
          const u = new URL(parsedUrl.toString());
          for (const [k, v] of Object.entries(extraParams)) {
            u.searchParams.set(k, String(v));
          }
          return u.toString();
        };

        // 2. Sibling path rewrites replacing trailing /mpegts, /index.m3u8, /mono.m3u8, /video.m3u8, /live
        const tailRe = /\/(mpegts|index\.m3u8|mono\.m3u8|video\.m3u8|live)$/i;
        if (tailRe.test(parsedUrl.pathname)) {
          const baseDir = parsedUrl.pathname.replace(tailRe, '');
          pushUnique(withSiblingPath(`${baseDir}/timeshift_abs-${startSec}.m3u8`));
          pushUnique(withSiblingPath(`${baseDir}/timeshift_abs-${startSec}.ts`));
          pushUnique(withSiblingPath(`${baseDir}/index-${startSec}-${durSecs}.m3u8`));
          pushUnique(withSiblingPath(`${baseDir}/archive-${startSec}-${durSecs}.m3u8`));
          pushUnique(withSiblingPath(`${baseDir}/archive-${startSec}-${durSecs}.ts`));
          pushUnique(withSiblingPath(`${baseDir}/timeshift_rel-${offsetSec}.m3u8`));
          pushUnique(withSiblingPath(`${baseDir}/timeshift_rel-${offsetSec}.ts`));
          pushUnique(withSiblingPath(`${baseDir}/mpegts`, { utc: startSec, lutc: nowSec }));
          pushUnique(withSiblingPath(`${baseDir}/index.m3u8`, { utc: startSec, lutc: nowSec }));
        }

        // 3. Query-append variants preserving existing query tokens (?token=...)
        pushUnique(withQuery({ utc: startSec, lutc: nowSec }));
        pushUnique(withQuery({ utc: startSec, lutc: nowSec, duration: durSecs }));
        pushUnique(withQuery({ timeshift: offsetMin }));
        pushUnique(withQuery({ start: startSec, end: endSec }));
      }
    }
    return candidates;
  }

  async function resolveCatchupStream(channel, program) {
    const candidates = buildCatchupCandidates(channel, program);
    if (!candidates.length) {
      return { ok: false, error: 'Channel has no Catch-up archive configuration', candidates: [] };
    }
    const callResolve = async (list) => {
      const resp = await fetch('/catchup/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: list,
          liveUrl: channel.url || '',
          userAgent: channel.userAgent || ''
        })
      });
      const data = await resp.json();
      return { ok: resp.ok, data, status: resp.status };
    };

    try {
      const first = await callResolve(candidates);
      if (first.ok && first.data && first.data.ok && first.data.resolvedUrl) {
        return { ok: true, url: first.data.resolvedUrl, candidates };
      }

      // Clock/Year Drift Guard: if server Date differs by > 30 mins from local clock, re-probe with drift-adjusted timestamps
      const serverNowSec = first.data && Number(first.data.serverNowSec);
      const localNowSec = Math.floor(Date.now() / 1000);
      if (Number.isFinite(serverNowSec) && serverNowSec > 0 && Math.abs(serverNowSec - localNowSec) > 1800) {
        const driftSec = serverNowSec - localNowSec;
        const baseStartSec = Math.floor(program.start / 1000);
        const driftCandidates = buildCatchupCandidates(channel, program, {
          startSec: baseStartSec + driftSec,
          nowSec: serverNowSec
        }).filter((u) => !candidates.includes(u));
        if (driftCandidates.length) {
          console.log(`[CATCHUP-DRIFT] Adjusting by ${driftSec}s (serverNow=${serverNowSec})`);
          const second = await callResolve(driftCandidates);
          if (second.ok && second.data && second.data.ok && second.data.resolvedUrl) {
            return { ok: true, url: second.data.resolvedUrl, candidates: [...driftCandidates, ...candidates] };
          }
        }
      }

      return {
        ok: false,
        error: (first.data && first.data.error) || `HTTP ${first.status}`,
        candidates
      };
    } catch (err) {
      return { ok: false, error: err.message || 'Catch-up probe failed', candidates };
    }
  }

  async function playCatchupProgram(channel, program) {
    if (!channel || !program || !Number.isFinite(Number(program.start)) || Number(program.start) <= 0) {
      showToast('Catch-up unavailable: missing valid program start time');
      return false;
    }
    const nowMs = Date.now();
    if (program.start >= nowMs) {
      showToast('Catch-up unavailable: program has not aired yet');
      return false;
    }
    const maxDays = Number(channel.catchupDays) > 0 ? Number(channel.catchupDays) : 7;
    if (program.start < nowMs - maxDays * 86400000) {
      showToast(`Catch-up unavailable: older than ${maxDays} days`);
      return false;
    }
    setMpvPlayingOverlayHidden(false);
    el.emptyOverlay.classList.add('hidden');
    if (el.loadingText) el.loadingText.textContent = 'Resolving Catch-up stream...';
    if (el.loadingOverlay) el.loadingOverlay.classList.remove('hidden');
    showToast('Resolving Catch-up stream...', 2000);

    const resolved = await resolveCatchupStream(channel, program);
    if (!resolved.ok) {
      if (el.loadingOverlay) el.loadingOverlay.classList.add('hidden');
      showToast(`Catch-up unavailable: ${resolved.error}`, 5000);
      return false;
    }

    state.catchupRetryQueue = resolved.candidates.filter((u) => u !== resolved.url);
    state.catchupRetryContext = { channel, program };
    state.lastCatchupUrl = resolved.url;
    console.log('[CATCHUP-URL]', resolved.url);
    playChannel(
      { ...channel, url: resolved.url },
      {
        overrideUrl: resolved.url,
        isCatchup: true,
        programTitle: program.title,
        programStart: program.start,
        programStop: program.stop || program.end
      }
    );
    return true;
  }

  function hideUnmuteBanner() {
    if (state.unmuteBannerEl) {
      state.unmuteBannerEl.remove();
      state.unmuteBannerEl = null;
    }
  }

  function showUnmuteBanner() {
    if (state.unmuteBannerEl || !el.playerStage) return;
    const banner = document.createElement('button');
    banner.type = 'button';
    banner.className = 'osd-element';
    banner.textContent = 'Click or press any key to unmute';
    Object.assign(banner.style, {
      position: 'absolute',
      top: '5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '35',
      padding: '0.65rem 1.25rem',
      borderRadius: '999px',
      border: '1px solid rgba(56, 189, 248, 0.7)',
      background: 'rgba(15, 21, 34, 0.92)',
      color: '#f8fafc',
      fontWeight: '700',
      fontSize: '0.92rem',
      cursor: 'pointer',
      boxShadow: '0 10px 28px rgba(0, 0, 0, 0.65)'
    });

    const unmuteHandler = () => {
      el.video.muted = false;
      hideUnmuteBanner();
      updateOsd();
      showOsd();
      window.removeEventListener('keydown', unmuteHandler, true);
      window.removeEventListener('pointerdown', unmuteHandler, true);
    };

    banner.addEventListener('click', unmuteHandler);
    window.addEventListener('keydown', unmuteHandler, { capture: true, once: true });
    window.addEventListener('pointerdown', unmuteHandler, { capture: true, once: true });
    el.playerStage.appendChild(banner);
    state.unmuteBannerEl = banner;
  }

  async function attemptVideoPlay() {
    if (isMpvHost()) {
      try {
        el.video.pause();
        el.video.removeAttribute('src');
        el.video.src = '';
        el.video.load();
        el.video.style.display = 'none';
      } catch (_) {}
      return;
    }
    try {
      await el.video.play();
    } catch (err) {
      if (err && err.name === 'NotAllowedError') {
        el.video.muted = true;
        updateOsd();
        showOsd();
        showUnmuteBanner();
        try {
          await el.video.play();
        } catch (_) {}
      }
    }
  }

  function isTelegramOrLocalMedia(channel, targetUrl) {
    const resolvedUrl = targetUrl || (channel && channel.url) || '';
    return Boolean(
      (channel && (channel.isTelegramVideo || channel.isNetShareVideo)) ||
      /^\/(tg|netshare)\/stream/i.test(resolvedUrl)
    );
  }

  async function playChannel(channel, options = {}) {
    if (!channel) return;

    if (!options.bypassPin && isCategoryLocked(channel.group)) {
      promptPinUnlock(channel.group, () => playChannel(channel, { ...options, bypassPin: true }));
      return;
    }

    // Strict Single-Stream Guard: abort any existing connection before starting a new one
    state.userPaused = false;
    teardownActiveStream();
    const myGen = state.playGeneration;

    if (!options.isReconnect) {
      state.reconnectAttempts = 0;
    }
    const targetUrl = options.overrideUrl || channel.url;
    const isDirectMediaStream = isTelegramOrLocalMedia(channel, targetUrl);
    const isTgStream = Boolean(channel.isTelegramVideo || /^\/tg\/stream/i.test(targetUrl || ''));
    const isHlsUrl = /\.m3u8(\?|$)/i.test(targetUrl || '') || String(channel.type || '').toLowerCase() === 'hls';
    const isRawTsOrExtensionlessLive = !isDirectMediaStream && !isHlsUrl && /^https?:\/\//i.test(targetUrl || '') && (
      /\.(ts|m2ts)(\?|$)/i.test(targetUrl || '') ||
      !/\.(mp4|webm|mov|m4v|mkv|avi|flv|wmv|mpg|mpeg)(\?|$)/i.test(targetUrl || '')
    );
    const isDirectFile =
      /\.(mp4|mkv|webm|mov|avi|m4v|ts|m2ts|flv|wmv|divx|vob|mpg|mpeg)(\?|$)/i.test(targetUrl) ||
      isTgStream ||
      isRawTsOrExtensionlessLive ||
      (Boolean(channel.isNetShareVideo) && !isHlsUrl) ||
      Boolean(options.isDirectStream);
    state.lastPlayOptions = { ...options, isDirectFile };
    if (!options.isCatchup && !options.isCatchupFallback) {
      state.catchupRetryQueue = [];
      state.catchupRetryContext = null;
    }
    state.currentChannel = channel;
    state.currentCatchupProgram = options.isCatchup
      ? { title: options.programTitle || 'Catch-up Archive', start: options.programStart || 0, stop: options.programStop || 0 }
      : null;
    state.catchupSeekOffsetSec = options.isCatchup ? (Number(options.catchupOffsetSec) || 0) : 0;
    if (!options.isCatchup && state.pendingCatchupSeek) {
      clearTimeout(state.pendingCatchupSeek.timer);
      state.pendingCatchupSeek = null;
    }
    state.fragLoadPercent = 0;
    if (el.bufferPercent) el.bufferPercent.textContent = '0%';
    if (channel.contentType === 'live' && !options.isCatchup) {
      localStorage.setItem(STORAGE_KEYS.LAST_CHANNEL, channel.id);
      if (channel.url) {
        localStorage.setItem(STORAGE_KEYS.LAST_CHANNEL_URL, channel.url);
      }
    }

    // Update recents
    recordRecentWatch(channel);

    setMpvPlayingOverlayHidden(false);
    el.emptyOverlay.classList.add('hidden');
    el.loadingText.dir = 'auto';
    el.loadingText.textContent = options.transcodeMode === 'transcode'
      ? 'Optimizing stream...'
      : (options.isCatchup
        ? `Loading Catch-up: ${options.programTitle || channel.name}...`
        : `Tuning to ${channel.name}...`);
    el.loadingOverlay.style.display = '';
    el.loadingOverlay.classList.remove('hidden');

    updateOsd();
    showOsd();
    filterAndRenderChannels();

    if (isMpvHost()) {
      await abortStaleProxyConnections();
      if (myGen !== state.playGeneration) return;
      state.mpvPlayingConfirmed = false;
      state.mpvErrorOccurred = false;
      state.mpvRecentRecorded = false;
      let mpvUrl = targetUrl || '';
      const isLocalOriginUrl = /^https?:\/\/(?:127\.0\.0\.1|localhost):/i.test(mpvUrl) || mpvUrl.startsWith('/');
      if (options.forceProxyMpv && !isDirectMediaStream && !isLocalOriginUrl && /^https?:\/\//i.test(mpvUrl)) {
        mpvUrl = buildUrl(mpvUrl, 0, true);
        state.mpvDirectRetry = null;
      } else if (!options.mpvProxyRetried && !isDirectMediaStream && !isLocalOriginUrl && /^https?:\/\//i.test(mpvUrl)) {
        state.mpvDirectRetry = { channel, options, targetUrl: buildUrl(mpvUrl, 0, true), forceProxy: true };
      } else {
        state.mpvDirectRetry = null;
      }
      if (/^\/netshare\/stream/i.test(mpvUrl)) {
        try {
          const qs = mpvUrl.includes('?') ? mpvUrl.slice(mpvUrl.indexOf('?')) : '';
          const r = await fetch(`/netshare/resolve-path${qs}`, { cache: 'no-store' });
          if (myGen !== state.playGeneration) return;
          if (r.ok) {
            const data = await r.json();
            if (data && data.ok && data.path) {
              mpvUrl = data.path;
            }
          }
        } catch (_) {}
        if (/^\/netshare\/stream/i.test(mpvUrl) && channel.directPath) {
          mpvUrl = channel.directPath;
        }
      }
      if (mpvUrl.startsWith('/')) {
        mpvUrl = window.location.origin + mpvUrl;
      }
      setMpvVisualActive(true);
      state.lastPendingPlayArgs = { url: mpvUrl, userAgent: channel.userAgent || '' };
      postMpvCommand('mpv:load', state.lastPendingPlayArgs);
      clearTimeout(state.videoCheckTimer);
      state.videoCheckTimer = setTimeout(() => {
        state.videoCheckTimer = null;
        if (myGen !== state.playGeneration || !state.mpvActive || state.mpvErrorOccurred) return;
        setMpvPlayingOverlayHidden(true);
      }, 200);
      return;
    }

    const useProxyEffective = isDirectMediaStream
      ? false
      : (options.useProxyOverride !== undefined ? options.useProxyOverride : state.settings.useProxy);
    if (useProxyEffective || isDirectMediaStream) {
      await abortStaleProxyConnections();
      if (myGen !== state.playGeneration) return;
    }

    let streamUrl = isDirectMediaStream
      ? targetUrl
      : buildUrl(targetUrl, options.cacheBust || 0, (isRawTsOrExtensionlessLive || options.forceRemux || options.transcodeMode === 'transcode') ? true : (options.useProxyOverride !== undefined ? options.useProxyOverride : null));

    if (streamUrl) {
      const containerHint = `${channel.fileName || ''} ${channel.directPath || ''} ${targetUrl || ''}`;
      const isNonMp4Container = isDirectMediaStream && /\.(mkv|avi|ts|m2ts|flv|wmv|mov|divx|mpg|mpeg)(\?|$)/i.test(containerHint);
      if (options.transcodeMode === 'transcode') {
        streamUrl = streamUrl.replace(/([?&])(remux|transcode)=[^&]*/gi, '$1').replace(/[?&]$/, '');
        streamUrl += (streamUrl.includes('?') ? '&' : '?') + 'transcode=1';
      } else if ((isNonMp4Container || isRawTsOrExtensionlessLive || options.forceRemux) && !/[?&](remux|transcode)=1/i.test(streamUrl)) {
        streamUrl += (streamUrl.includes('?') ? '&' : '?') + 'remux=1';
      }
    }

    el.video.style.display = 'block';
    el.video.style.opacity = '1';
    el.video.style.visibility = 'visible';
    el.video.style.zIndex = '1';

    if (!isDirectFile && window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        manifestLoadingTimeOut: 20000,
        fragLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 4
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(el.video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (myGen !== state.playGeneration) return;
        syncTrackSelectors();
        attemptVideoPlay();
      });

      hls.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, syncTrackSelectors);
      hls.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, syncTrackSelectors);
      hls.on(window.Hls.Events.FRAG_LOAD_PROGRESS, (event, data) => {
        if (myGen !== state.playGeneration) return;
        const stats = data && data.stats;
        if (stats && stats.total > 0) {
          state.fragLoadPercent = Math.min(100, Math.round((stats.loaded / stats.total) * 100));
          if (!el.loadingOverlay.classList.contains('hidden')) {
            updateBufferProgress(false);
          }
        }
      });
      hls.on(window.Hls.Events.FRAG_LOADED, (event, data) => {
        if (data && data.frag && data.frag.stats && data.frag.duration > 0) {
          const bytes = data.frag.stats.total || data.frag.stats.loaded || 0;
          if (bytes > 0) {
            state.lastBitrateKbps = Math.round((bytes * 8) / (data.frag.duration * 1000));
          }
        }
      });

      let hlsMediaRecoveries = 0;
      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (!data.fatal || myGen !== state.playGeneration) return;
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          if (options.isStartupResume) {
            const startupRetry = options.startupRetryCount || 0;
            if (startupRetry < 3) {
              const nextUseProxy = !useProxyEffective;
              teardownActiveStream();
              el.loadingText.textContent = `Resuming ${channel.name} (retry ${startupRetry + 1}/3)...`;
              el.loadingOverlay.style.display = '';
    el.loadingOverlay.classList.remove('hidden');
              state.startupRetryTimer = setTimeout(() => {
                state.startupRetryTimer = null;
                playChannel(channel, {
                  ...options,
                  isStartupResume: true,
                  startupRetryCount: startupRetry + 1,
                  useProxyOverride: nextUseProxy,
                  cacheBust: Date.now()
                });
              }, 1500);
              return;
            }
          }
          if (!options.hasRetriedFresh) {
            playChannel(channel, { ...options, hasRetriedFresh: true, cacheBust: Date.now() });
            return;
          }
          // If HLS manifest fails on a raw MPEG-TS stream, fall back to /proxy&remux=1 on <video>
          if ((data.details === 'manifestLoadError' || data.details === 'manifestParsingError') && !/\.m3u8(\?|$)/i.test(targetUrl) && !options.hasHlsFallbackRemux) {
            playChannel(channel, { ...options, isDirectStream: true, forceRemux: true, hasHlsFallbackRemux: true });
            return;
          }
          scheduleReconnect();
        } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          hlsMediaRecoveries += 1;
          if (hlsMediaRecoveries === 1) {
            hls.recoverMediaError();
          } else if (hlsMediaRecoveries === 2) {
            hls.swapAudioCodec();
            hls.recoverMediaError();
          } else {
            teardownActiveStream();
            el.loadingText.textContent = 'Unsupported HLS codec/media — playback stopped';
            el.loadingOverlay.style.display = '';
    el.loadingOverlay.classList.remove('hidden');
          }
        } else {
          scheduleReconnect();
        }
      });

      state.hls = hls;
    } else {
      const escalateDirectMedia = () => {
        if (myGen !== state.playGeneration || options.hasEscalatedTranscode) return false;
        if (!options.forceRemux && !/[?&](remux|transcode)=1/i.test(streamUrl)) {
          playChannel(channel, { ...options, forceRemux: true });
          return true;
        }
        if (options.transcodeMode !== 'transcode') {
          playChannel(channel, { ...options, isDirectStream: true, transcodeMode: 'transcode', hasEscalatedTranscode: true });
          return true;
        }
        return false;
      };
      el.video.onloadedmetadata = () => {
        if (myGen !== state.playGeneration) return;
        if (isDirectMediaStream && el.video.videoWidth === 0) {
          clearTimeout(state.videoCheckTimer);
          state.videoCheckTimer = setTimeout(() => {
            state.videoCheckTimer = null;
            if (myGen !== state.playGeneration) return;
            if (el.video.videoWidth === 0) {
              escalateDirectMedia();
            }
          }, 1200);
        }
      };
      el.video.onerror = () => {
        if (myGen !== state.playGeneration) return;
        const errCode = el.video.error ? el.video.error.code : 0;
        if (errCode === 3 || errCode === 4) {
          if (escalateDirectMedia()) return;
          clearTimeout(state.reconnectTimer);
          state.reconnectTimer = null;
          clearTimeout(state.startupRetryTimer);
          state.startupRetryTimer = null;
          el.loadingText.textContent = `Unsupported codec/container (MediaError ${errCode})`;
          el.loadingOverlay.style.display = '';
    el.loadingOverlay.classList.remove('hidden');
          return;
        }
        if (state.osdSeeking || el.video.seeking) {
          return;
        }
        if (!options.hasRetriedFresh) {
          playChannel(channel, { ...options, hasRetriedFresh: true, cacheBust: Date.now() });
          return;
        }
        scheduleReconnect();
      };
      el.video.style.display = 'block';
      el.video.style.opacity = '1';
      el.video.style.visibility = 'visible';
      el.video.style.zIndex = '1';
      el.video.src = streamUrl;
      attemptVideoPlay();
    }
  }

  function zapChannel(delta) {
    const list = state.filteredChannels.length ? state.filteredChannels : state.channels;
    if (!list.length) return;
    if (!state.currentChannel) {
      playChannel(list[0]);
      return;
    }
    const idx = list.findIndex((c) => c.id === state.currentChannel.id);
    const nextIdx = idx < 0 ? 0 : (idx + delta + list.length) % list.length;
    playChannel(list[nextIdx]);
  }

  function snapshotFavoriteChannel(channel) {
    return {
      id: channel.id,
      number: channel.number || 0,
      name: channel.name || 'Untitled',
      group: channel.group || 'Uncategorized',
      url: channel.url || '',
      directPath: channel.directPath || '',
      logo: channel.logo || '',
      epgId: channel.epgId || '',
      contentType: channel.contentType || (channel.isTelegramVideo ? 'telegram' : 'live'),
      isTelegramVideo: Boolean(channel.isTelegramVideo),
      isNetShareVideo: Boolean(channel.isNetShareVideo),
      isDirectStream: Boolean(channel.isDirectStream),
      fileName: channel.fileName || '',
      mimeType: channel.mimeType || '',
      duration: channel.duration || 0,
      size: channel.size || 0,
      seriesId: channel.seriesId || '',
      catchupDays: channel.catchupDays || 0
    };
  }

  function setFavFolderValidation(msg) {
    if (!el.favFolderValidation) return;
    if (msg) {
      el.favFolderValidation.textContent = msg;
      el.favFolderValidation.classList.remove('hidden');
    } else {
      el.favFolderValidation.textContent = '';
      el.favFolderValidation.classList.add('hidden');
    }
  }

  function createFavoriteFolder(rawName) {
    const name = String(rawName || '').trim();
    if (!name) {
      setFavFolderValidation('Please enter a folder name.');
      if (el.favNewFolderInput) el.favNewFolderInput.focus();
      return null;
    }
    const duplicate = state.favoriteStore.folders.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setFavFolderValidation(`A folder named "${duplicate.name}" already exists.`);
      if (el.favNewFolderInput) el.favNewFolderInput.focus();
      return null;
    }
    setFavFolderValidation('');
    const id = `fav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const nextOrder = state.favoriteStore.folders.length;
    const folder = { id, name, order: nextOrder };
    state.favoriteStore.folders.push(folder);
    saveFavorites();
    renderFavFolderBar();
    renderFavFolderManagerList();
    showToast(`Created folder "${name}"`);
    return folder;
  }

  function renameFavoriteFolder(folderId, rawName) {
    const name = String(rawName || '').trim();
    if (!name) return;
    const folder = state.favoriteStore.folders.find((f) => f.id === folderId);
    if (!folder) return;
    folder.name = name;
    saveFavorites();
    renderFavFolderBar();
    renderFavFolderManagerList();
    filterAndRenderChannels();
    showToast(`Renamed folder to "${name}"`);
  }

  function deleteFavoriteFolder(folderId) {
    if (folderId === 'general') {
      showToast('Default "General" folder cannot be deleted');
      return;
    }
    state.favoriteStore.items.forEach((item) => {
      if (item.folderId === folderId) item.folderId = 'general';
    });
    state.favoriteStore.folders = state.favoriteStore.folders.filter((f) => f.id !== folderId);
    if (state.activeFavFolderId === folderId) {
      state.activeFavFolderId = 'ALL';
    }
    saveFavorites();
    renderFavFolderBar();
    renderFavFolderManagerList();
    filterAndRenderChannels();
    showToast('Folder deleted; items moved to General');
  }

  function moveFavoriteItemToFolder(itemKey, folderId) {
    const entry = state.favoriteStore.items.find((i) => i.key === itemKey);
    if (!entry) return;
    entry.folderId = folderId;
    saveFavorites();
    renderFavFolderBar();
    filterAndRenderChannels();
    const folder = state.favoriteStore.folders.find((f) => f.id === folderId);
    showToast(`Moved to "${folder ? folder.name : 'General'}"`);
  }

  function assignChannelToFavoriteFolder(channel, folderId) {
    if (!channel) return;
    const existing = state.favoriteStore.items.find((i) => i.key === channel.id);
    if (existing) {
      existing.folderId = folderId;
      existing.channelData = snapshotFavoriteChannel(channel);
    } else {
      state.favoriteStore.items.push({
        key: channel.id,
        type: channel.contentType || (channel.isTelegramVideo ? 'telegram' : 'live'),
        folderId,
        channelData: snapshotFavoriteChannel(channel)
      });
    }
    saveFavorites();
    updateOsd();
    renderCategories();
    renderFavFolderBar();
    filterAndRenderChannels();
    const folder = state.favoriteStore.folders.find((f) => f.id === folderId);
    showToast(`Saved ${channel.name} to "${folder ? folder.name : 'General'}"`);
  }

  function removeChannelFromFavorites(channelId, label = 'item') {
    const idx = state.favoriteStore.items.findIndex((i) => i.key === channelId);
    if (idx < 0) return;
    state.favoriteStore.items.splice(idx, 1);
    saveFavorites();
    updateOsd();
    renderCategories();
    renderFavFolderBar();
    filterAndRenderChannels();
    showToast(`Removed ${label} from Favorites`);
  }

  function toggleFavorite(channel = state.currentChannel) {
    if (!channel) return;
    openFavPicker(channel);
  }

  function togglePlayPause() {
    if (!state.currentChannel && !el.video.getAttribute('src')) return;
    if (state.mpvActive) {
      const nextPaused = !state.mpvPaused;
      state.userPaused = nextPaused;
      state.mpvPaused = nextPaused;
      postMpvCommand('mpv:pause', { paused: nextPaused });
      updateOsd();
      showOsd();
      return;
    }
    if (el.video.paused) {
      state.userPaused = false;
      el.video.play().catch(() => {});
    } else {
      state.userPaused = true;
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
      el.video.pause();
    }
    updateOsd();
    showOsd();
  }

  function stopPlayback() {
    state.userPaused = false;
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
    clearTimeout(state.startupRetryTimer);
    state.startupRetryTimer = null;
    clearTimeout(state.videoCheckTimer);
    state.videoCheckTimer = null;
    teardownActiveStream();
    abortStaleProxyConnections();
    setMpvPlayingOverlayHidden(false);
    if (document.body) document.body.classList.remove('video-playing');
    state.currentChannel = null;
    el.loadingOverlay.classList.add('hidden');
    el.emptyOverlay.classList.remove('hidden');
    updateOsd();
    openDrawer();
  }

  function extractMediaBadges(item) {
    if (!item) return [];
    const haystack = [item.name, item.fileName, item.group, item.url].filter(Boolean).join(' ');
    const badges = [];
    const is4k = /\b(4k|uhd|2160p)\b/i.test(haystack);
    if (is4k) {
      badges.push({ label: '4K', cls: 'badge-4k' });
    } else if (/\b(1080p|fhd)\b/i.test(haystack)) {
      badges.push({ label: 'FHD', cls: 'badge-fhd' });
    } else if (/\b(720p)\b/i.test(haystack)) {
      badges.push({ label: 'HD', cls: '' });
    }
    if (/\b(hevc|h\.?265|x265)\b/i.test(haystack)) {
      badges.push({ label: 'HEVC', cls: 'badge-hevc' });
    }
    if (/\b(hdr10\+?|hdr|dolby\s*vision|dovi)\b/i.test(haystack)) {
      badges.push({ label: 'HDR', cls: 'badge-hdr' });
    }
    if (/\b(5\.1|7\.1|ddp?5\.1|eac3|ac3|atmos)\b/i.test(haystack)) {
      badges.push({ label: '5.1', cls: 'badge-audio' });
    }
    return badges;
  }

  function renderQualityBadgesHtml(item) {
    const badges = extractMediaBadges(item);
    if (!badges.length) return '';
    return `<span class="ch-badges">${badges.map((b) => `<span class="ch-quality-badge${b.cls ? ' ' + b.cls : ''}">${b.label}</span>`).join('')}</span>`;
  }

  // OSD Management
  function updateOsd() {
    const ch = state.currentChannel;
    if (!ch) {
      el.osdNumber.textContent = '000';
      el.osdName.textContent = 'No Channel Selected';
      el.osdCategory.textContent = 'Uncategorized';
      el.osdStreamMeta.textContent = 'IDLE';
      el.osdLogo.classList.add('hidden');
      el.osdLogoFallback.classList.remove('hidden');
      el.osdFavBtn.classList.remove('is-active');
      el.osdFavBtn.innerHTML = `${OSD_ICONS.starOutline}<span>Favorite</span>`;
      return;
    }

    const displayName = cleanChannelTitle(ch.name) || ch.name || 'Channel';
    el.osdNumber.textContent = String(ch.number).padStart(3, '0');
    el.osdName.dir = 'auto';
    el.osdName.textContent = displayName;
    el.osdCategory.dir = 'auto';
    el.osdCategory.textContent = ch.group || 'Uncategorized';

    if (ch.logo) {
      el.osdLogo.src = buildUrl(ch.logo);
      el.osdLogo.classList.remove('hidden');
      el.osdLogoFallback.classList.add('hidden');
      el.osdLogo.onerror = () => {
        el.osdLogo.classList.add('hidden');
        el.osdLogoFallback.classList.remove('hidden');
      };
    } else {
      el.osdLogo.classList.add('hidden');
      el.osdLogoFallback.textContent = displayName.slice(0, 2).toUpperCase();
      el.osdLogoFallback.classList.remove('hidden');
    }

    const isFav = state.favorites.has(ch.id);
    el.osdFavBtn.classList.toggle('is-active', isFav);
    el.osdFavBtn.innerHTML = isFav
      ? `${OSD_ICONS.starFilled}<span>Favorited</span>`
      : `${OSD_ICONS.starOutline}<span>Favorite</span>`;

    const isPaused = state.mpvActive ? state.mpvPaused : el.video.paused;
    const isMuted = state.mpvActive ? state.mpvMuted : el.video.muted;
    el.osdPlayPauseBtn.innerHTML = isPaused
      ? `${OSD_ICONS.play}<span>Play</span>`
      : `${OSD_ICONS.pause}<span>Pause</span>`;
    el.osdMuteBtn.innerHTML = isMuted
      ? `${OSD_ICONS.unmute}<span>Unmute</span>`
      : `${OSD_ICONS.mute}<span>Mute</span>`;
    el.osdMuteBtn.classList.toggle('is-active', isMuted);

    const res = state.currentCatchupProgram
      ? 'CATCH-UP'
      : (el.video.videoHeight ? `${el.video.videoHeight}p` : (ch.isTelegramVideo ? 'VOD' : 'LIVE'));
    const mode = state.mpvActive ? 'MPV' : (ch.isTelegramVideo ? 'TELEGRAM' : (state.hls ? 'HLS' : 'DIRECT'));
    const badges = extractMediaBadges(ch).map((b) => b.label);
    el.osdStreamMeta.textContent = [res, mode, ...badges].join(' • ');

    updateSeekUi();

    const catchupInfo = state.currentCatchupProgram;
    const epg = getNowAndNext(ch);
    el.osdNowTitle.dir = 'auto';
    el.osdNextTitle.dir = 'auto';
    if (catchupInfo) {
      el.osdNowTitle.textContent = `[Catch-up] ${catchupInfo.title}`;
      el.osdNowTime.textContent = (catchupInfo.start && catchupInfo.stop)
        ? `${formatProgramDayBadge(catchupInfo.start)} ${formatTime(catchupInfo.start)} - ${formatTime(catchupInfo.stop)}`
        : 'Archive';
      const total = getMediaDurationSeconds();
      const cur = getMediaPositionSeconds();
      const pct = total > 0 ? Math.max(0, Math.min(100, (cur / total) * 100)) : 0;
      el.osdProgressFill.style.width = `${pct.toFixed(1)}%`;
    } else if (epg.now) {
      el.osdNowTitle.textContent = epg.now.title;
      el.osdNowTime.textContent = `${formatTime(epg.now.start)} - ${formatTime(epg.now.stop)}`;
      const pct = Math.max(0, Math.min(100, ((Date.now() - epg.now.start) / (epg.now.stop - epg.now.start)) * 100));
      el.osdProgressFill.style.width = `${pct.toFixed(1)}%`;
    } else {
      el.osdNowTitle.textContent = ch.isTelegramVideo ? displayName : 'No program information';
      el.osdNowTime.textContent = '';
      el.osdProgressFill.style.width = '0%';
    }

    el.osdNextTitle.textContent = epg.next ? `${epg.next.title} (${formatTime(epg.next.start)})` : '--';
  }

  function formatDurationClock(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function getMediaDurationSeconds() {
    const catchup = state.currentCatchupProgram;
    if (catchup && catchup.start && (catchup.stop || catchup.end)) {
      const programDurationSec = Math.max(1, Math.floor(((catchup.stop || catchup.end) - catchup.start) / 1000));
      if (programDurationSec > 0) return programDurationSec;
    }
    if (state.mpvActive && Number.isFinite(state.mpvDuration) && state.mpvDuration > 0) {
      return state.mpvDuration;
    }
    if (Number.isFinite(el.video.duration) && el.video.duration > 0) {
      return el.video.duration;
    }
    return (state.currentChannel && Number(state.currentChannel.duration)) || 0;
  }

  function getMediaPositionSeconds() {
    const raw = state.mpvActive
      ? (Number.isFinite(state.mpvPosition) ? state.mpvPosition : 0)
      : (Number.isFinite(el.video.currentTime) ? el.video.currentTime : 0);
    const total = getMediaDurationSeconds();
    const pos = state.currentCatchupProgram
      ? (Number(state.catchupSeekOffsetSec) || 0) + raw
      : raw;
    return total > 0 ? Math.max(0, Math.min(total, pos)) : Math.max(0, pos);
  }

  function isSeekableMedia() {
    const ch = state.currentChannel;
    if (!ch) return false;
    return Boolean(
      state.currentCatchupProgram ||
      ch.isCatchup ||
      (state.lastPlayOptions && state.lastPlayOptions.isCatchup) ||
      ch.isTelegramVideo ||
      ch.isNetShareVideo ||
      ch.contentType === 'vod' ||
      ch.contentType === 'series' ||
      (state.mpvActive && Number.isFinite(state.mpvDuration) && state.mpvDuration > 0) ||
      (Number.isFinite(el.video.duration) && el.video.duration > 0)
    );
  }

  function updateSeekUi() {
    if (!el.osdSeekRow || !el.osdSeekBar) return;
    const seekable = isSeekableMedia();
    el.osdSeekRow.classList.toggle('hidden', !seekable);
    el.osdSeekRow.classList.toggle('is-catchup-seekable', Boolean(seekable && state.currentCatchupProgram));
    if (el.osdProgressTrack) {
      el.osdProgressTrack.classList.toggle('hidden', seekable);
    }
    if (!seekable) return;
    const total = getMediaDurationSeconds();
    const cur = getMediaPositionSeconds();
    if (el.osdCurrentTime) el.osdCurrentTime.textContent = formatDurationClock(cur);
    if (el.osdTotalTime) el.osdTotalTime.textContent = formatDurationClock(total);
    if (!state.osdSeeking) {
      const pct = total > 0 ? Math.max(0, Math.min(100, (cur / total) * 100)) : 0;
      el.osdSeekBar.value = pct.toFixed(1);
      el.osdSeekBar.style.setProperty('--seek-pct', `${pct.toFixed(1)}%`);
    }
  }

  function showOsd() {
    el.playerStage.classList.remove('osd-hidden');
    notifyHostPowerMode(false);
    clearTimeout(state.osdTimer);
    const isPaused = state.mpvActive ? state.mpvPaused : el.video.paused;
    if (state.currentChannel && !isAnyOverlayOpen() && !state.userPaused && !isPaused) {
      state.osdTimer = setTimeout(() => {
        const stillPaused = state.mpvActive ? state.mpvPaused : el.video.paused;
        if (!isAnyOverlayOpen() && state.currentChannel && !state.userPaused && !stillPaused) {
          el.playerStage.classList.add('osd-hidden');
          notifyHostPowerMode(true);
        }
      }, state.settings.osdTimeout);
    }
  }

  function toggleOsd() {
    if (el.playerStage.classList.contains('osd-hidden')) {
      showOsd();
    } else {
      clearTimeout(state.osdTimer);
      el.playerStage.classList.add('osd-hidden');
      notifyHostPowerMode(true);
    }
  }

  // Content Mode Helpers & Parental Controls
  function getActiveModeItems() {
    if (state.contentMode === 'catchup') {
      return state.channels.filter((c) => hasCatchupSupport(c));
    }
    if (state.contentMode === 'favorites') {
      return resolveFavoriteListItems();
    }
    return state.channels.filter((c) =>
      c &&
      !c.isNetShareFolder &&
      (c.contentType === 'live' || !c.contentType || c.isLive)
    );
  }

  function setContentMode(mode) {
    const allowedModes = ['live', 'catchup', 'favorites', 'telegram', 'netshare'];
    const normalizedMode = allowedModes.includes(mode) ? mode : 'live';
    state.contentMode = normalizedMode;
    state.activeSeries = null;
    state.seriesEpisodes = [];
    if (el.seriesBackBar) el.seriesBackBar.classList.add('hidden');
    state.activeTgChannel = null;
    state.tgVideos = [];
    if (el.telegramBackBar) el.telegramBackBar.classList.add('hidden');
    state.activeNetShare = null;
    state.netShareSubpath = '';
    state.netShareFolders = [];
    state.netShareFiles = [];
    if (el.netshareBackBar) el.netshareBackBar.classList.add('hidden');
    state.selectedCategory = normalizedMode === 'favorites' ? 'FAVORITES' : 'ALL';
    el.contentModeTabs.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === normalizedMode);
    });
    if (normalizedMode === 'telegram' && state.tgAuthenticated && !state.tgChannels.length) {
      loadTelegramChannels().then(() => filterAndRenderChannels());
    }
    if (normalizedMode === 'netshare' && !state.netShares.length) {
      loadNetSharesList().then(() => filterAndRenderChannels());
    }
    renderCategories();
    filterAndRenderChannels();
    syncTacticalCategoryProp(normalizedMode);
  }

  async function loadNetSharesList() {
    try {
      const resp = await fetch('/netshare/list');
      if (!resp.ok) return;
      const data = await resp.json();
      state.netShares = Array.isArray(data.shares) ? data.shares : [];
      renderNetShareSavedList();
      if (state.contentMode === 'netshare') {
        renderCategories();
        filterAndRenderChannels();
      }
    } catch (_) {}
  }

  function renderNetShareSavedList() {
    if (!el.netshareSavedList) return;
    el.netshareSavedList.innerHTML = '';
    if (!state.netShares.length) {
      const empty = document.createElement('div');
      empty.className = 'source-row-meta';
      empty.textContent = 'No network folders saved yet.';
      el.netshareSavedList.appendChild(empty);
      return;
    }

    for (let i = 0; i < state.netShares.length; i++) {
      const share = state.netShares[i];
      const row = document.createElement('div');
      row.className = 'source-row';

      const info = document.createElement('div');
      info.className = 'source-row-info';

      const title = document.createElement('div');
      title.className = 'source-row-title';

      const badge = document.createElement('span');
      badge.className = 'source-type-badge';
      badge.textContent = share.type === 'smb' ? 'SMB' : share.type === 'webdav' ? 'WebDAV' : 'Local';

      const label = document.createElement('span');
      label.className = 'source-row-label';
      label.setAttribute('dir', 'auto');
      label.textContent = share.name || share.path;

      title.appendChild(badge);
      title.appendChild(label);

      const meta = document.createElement('div');
      meta.className = 'source-row-meta';
      meta.setAttribute('dir', 'auto');
      meta.textContent = share.path + (share.username ? ` (${share.username})` : '');

      info.appendChild(title);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'source-row-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn btn-secondary btn-sm focusable';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => {
        closeSettings();
        openDrawer();
        setContentMode('netshare');
        browseNetShare(share, '');
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-danger btn-sm focusable';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeNetShare(share.id));

      actions.appendChild(openBtn);
      actions.appendChild(removeBtn);

      row.appendChild(info);
      row.appendChild(actions);
      el.netshareSavedList.appendChild(row);
    }
  }

  async function addNetShare() {
    const name = (el.netshareNameInput.value || '').trim();
    const sharePath = (el.netsharePathInput.value || '').trim();
    const username = (el.netshareUserInput.value || '').trim();
    const password = el.netsharePassInput.value || '';

    if (!sharePath) {
      setSettingsStatus('Please enter a network share path or URL.', 'error');
      return;
    }

    setSettingsStatus('Saving network folder...', 'info');
    try {
      const resp = await fetch('/netshare/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || sharePath, path: sharePath, username, password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      el.netshareNameInput.value = '';
      el.netsharePathInput.value = '';
      el.netshareUserInput.value = '';
      el.netsharePassInput.value = '';
      await loadNetSharesList();
      setSettingsStatus(`Added network folder "${data.share.name}".`, 'success');
    } catch (err) {
      setSettingsStatus(`Failed to add network folder: ${err.message}`, 'error');
    }
  }

  async function removeNetShare(id) {
    try {
      const resp = await fetch(`/netshare/remove?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      if (state.activeNetShare && state.activeNetShare.id === id) {
        state.activeNetShare = null;
        state.netShareSubpath = '';
        state.netShareFolders = [];
        state.netShareFiles = [];
        if (el.netshareBackBar) el.netshareBackBar.classList.add('hidden');
      }
      await loadNetSharesList();
      setSettingsStatus('Network folder removed.', 'success');
    } catch (err) {
      setSettingsStatus(`Failed to remove network folder: ${err.message}`, 'error');
    }
  }

  async function browseNetShare(share, subpath = '') {
    if (!share) return;
    state.activeNetShare = share;
    state.netShareSubpath = subpath || '';
    if (el.netshareBackBar) {
      el.netshareBackBar.classList.remove('hidden');
      el.netshareBackTitle.textContent = subpath ? `${share.name} / ${subpath}` : share.name;
    }
    el.channelList.innerHTML = '<div class="helper-text" style="padding:1rem;">Loading folder contents...</div>';
    try {
      const url = `/netshare/browse?id=${encodeURIComponent(share.id)}&subpath=${encodeURIComponent(subpath || '')}`;
      const resp = await fetch(url);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.ok === false) {
        throw new Error(data.error || data.detail || `HTTP ${resp.status}`);
      }
      state.netShareFolders = Array.isArray(data.folders) ? data.folders : [];
      state.netShareFiles = Array.isArray(data.files) ? data.files : [];
      filterAndRenderChannels();
    } catch (err) {
      el.channelList.innerHTML = `<div class="helper-text" style="padding:1rem;">Failed to browse folder: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderNetShareDrawer() {
    const q = state.searchQuery.trim().toLowerCase();
    el.channelList.innerHTML = '';

    if (!state.activeNetShare) {
      if (el.netshareBackBar) el.netshareBackBar.classList.add('hidden');
      let list = state.netShares;
      if (q) {
        list = list.filter((s) =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.path || '').toLowerCase().includes(q)
        );
      }
      el.drawerChannelCount.textContent = `${list.length.toLocaleString()} shares`;
      if (!list.length) {
        el.channelList.innerHTML = '<div class="helper-text" style="padding:1rem;">No network folders configured. Add one in Setup &rarr; Network Folders.</div>';
        return;
      }
      const frag = document.createDocumentFragment();
      for (let i = 0; i < list.length; i++) {
        const share = list[i];
        const btn = document.createElement('button');
        btn.className = 'channel-item focusable';
        btn.tabIndex = 0;
        btn.innerHTML = `
          <span class="ch-num">${String(i + 1).padStart(3, '0')}</span>
          <div class="ch-info">
            <div class="ch-name" dir="auto">${escapeHtml(share.name || share.path)}</div>
            <div class="ch-program" dir="auto">${escapeHtml(share.path)}</div>
          </div>
        `;
        btn.addEventListener('click', () => browseNetShare(share, ''));
        frag.appendChild(btn);
      }
      el.channelList.appendChild(frag);
      return;
    }

    const share = state.activeNetShare;
    let folders = state.netShareFolders;
    let files = state.netShareFiles;
    if (q) {
      folders = folders.filter((f) => (f.name || '').toLowerCase().includes(q));
      files = files.filter((f) => (f.name || '').toLowerCase().includes(q));
    }

    const totalCount = folders.length + files.length;
    el.drawerChannelCount.textContent = `${totalCount.toLocaleString()} items`;
    if (!totalCount) {
      el.channelList.innerHTML = '<div class="helper-text" style="padding:1rem;">No folders or playable videos found in this directory.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    let idxCounter = 0;

    for (let i = 0; i < folders.length; i++) {
      idxCounter++;
      const f = folders[i];
      const folderItem = {
        id: `nsfolder_${share.id}::${f.subpath}`,
        name: f.name,
        group: share.name || 'Network Share',
        isNetShareFolder: true,
        netShareId: share.id,
        netShareSubpath: f.subpath,
        contentType: 'netshare_folder'
      };
      const isFav = state.favorites.has(folderItem.id);
      const btn = document.createElement('button');
      btn.className = 'channel-item focusable';
      btn.tabIndex = 0;
      btn.innerHTML = `
        <span class="ch-num">${String(idxCounter).padStart(3, '0')}</span>
        <div class="ch-info">
          <div class="ch-name" dir="auto">&#128193; ${escapeHtml(f.name)}</div>
          <div class="ch-program" dir="auto">Folder &bull; ${escapeHtml(share.name)}</div>
        </div>
        <span class="ch-fav focusable${isFav ? ' is-active' : ''}" role="button" tabindex="0" title="${isFav ? 'Manage Favorite Folder' : 'Add to Favorite Folder'}">${isFav ? '&#9733;' : '&#9734;'}</span>
      `;
      btn.addEventListener('click', (e) => {
        if (e.target && e.target.closest('.ch-fav')) {
          e.stopPropagation();
          openFavPicker(folderItem);
          return;
        }
        browseNetShare(share, f.subpath);
      });
      frag.appendChild(btn);
    }

    const playableList = [];
    for (let i = 0; i < files.length; i++) {
      idxCounter++;
      const f = files[i];
      const streamUrl = `/netshare/stream?id=${encodeURIComponent(share.id)}&path=${encodeURIComponent(f.subpath)}`;
      const shareRoot = String(share.path || '').replace(/[\\/]+$/, '');
      const directPath = shareRoot ? `${shareRoot}\\${String(f.subpath || '').replace(/\//g, '\\')}` : '';
      const fileItem = {
        id: `nsfile_${share.id}::${f.subpath}`,
        number: idxCounter,
        name: f.name,
        group: share.name || 'Network Share',
        url: streamUrl,
        directPath,
        isNetShareVideo: true,
        isDirectStream: !/\.m3u8(\?|$)/i.test(f.name),
        contentType: 'vod'
      };
      playableList.push(fileItem);
      const isPlaying = state.currentChannel && state.currentChannel.id === fileItem.id;
      const isFav = state.favorites.has(fileItem.id);
      const metaLabel = [
        f.ext ? f.ext.replace('.', '').toUpperCase() : 'VIDEO',
        f.size ? formatFileSize(f.size) : ''
      ].filter(Boolean).join(' • ');

      const btn = document.createElement('button');
      btn.className = 'channel-item focusable' + (isPlaying ? ' playing' : '');
      btn.tabIndex = 0;
      btn.innerHTML = `
        <span class="ch-num">${String(idxCounter).padStart(3, '0')}</span>
        <div class="ch-info">
          <div class="ch-title-row">
            <div class="ch-name" dir="auto">${escapeHtml(f.name)}</div>
            ${renderQualityBadgesHtml(fileItem)}
          </div>
          <div class="ch-program" dir="auto">${escapeHtml(metaLabel)}</div>
        </div>
        <span class="ch-fav focusable${isFav ? ' is-active' : ''}" role="button" tabindex="0" title="${isFav ? 'Manage Favorite Folder' : 'Add to Favorite Folder'}">${isFav ? '&#9733;' : '&#9734;'}</span>
      `;
      btn.addEventListener('click', (e) => {
        if (e.target && e.target.closest('.ch-fav')) {
          e.stopPropagation();
          openFavPicker(fileItem);
          return;
        }
        playChannel(fileItem, { isDirectStream: fileItem.isDirectStream });
        closeDrawer();
      });
      frag.appendChild(btn);
    }

    state.filteredChannels = playableList;
    el.channelList.appendChild(frag);
  }

  function formatDurationSec(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    if (!s) return '';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(rem)}` : `${m}:${pad(rem)}`;
  }

  function formatFileSize(bytes) {
    const b = Number(bytes) || 0;
    if (!b) return '';
    if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${Math.max(1, Math.round(b / (1024 * 1024)))} MB`;
  }

  function beginTgSearchAbort() {
    if (state.tgSearchAbort) {
      state.tgSearchAbort.abort();
      state.tgSearchAbort = null;
    }
    state.tgSearchAbort = new AbortController();
    return state.tgSearchAbort.signal;
  }

  function mapTgVideos(rawVideos, fallbackGroup) {
    return rawVideos.map((v, idx) => ({
      id: `tg_${v.channelId}_${v.messageId}`,
      number: idx + 1,
      name: v.title || v.fileName || `Video #${v.messageId}`,
      group: v.channelTitle || fallbackGroup || `Channel ${v.channelId}`,
      url: `/tg/stream/${encodeURIComponent(v.channelId)}/${v.messageId}`,
      contentType: 'telegram',
      isTelegramVideo: true,
      fileName: v.fileName || '',
      mimeType: v.mimeType || '',
      duration: v.duration || 0,
      size: v.size || 0,
      date: v.date || 0
    }));
  }

  async function loadTelegramVideos(tgChannel, query = '') {
    if (!tgChannel) return;
    state.activeTgChannel = tgChannel;
    if (el.telegramBackTitle) el.telegramBackTitle.textContent = tgChannel.title || 'Telegram';
    if (el.telegramBackBar) el.telegramBackBar.classList.remove('hidden');
    el.channelList.innerHTML = '<div class="helper-text" style="padding:1rem;">Loading Telegram videos...</div>';

    const signal = beginTgSearchAbort();
    try {
      const qParam = query ? `&q=${encodeURIComponent(query)}` : '';
      const resp = await fetch(`/tg/videos?channelId=${encodeURIComponent(tgChannel.id)}${qParam}`, {
        cache: 'no-store',
        signal
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const rawVideos = Array.isArray(data.videos) ? data.videos : [];
      state.tgVideos = mapTgVideos(rawVideos, tgChannel.title || 'Telegram');
      filterAndRenderChannels();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      el.channelList.innerHTML = `<div class="helper-text" style="padding:1rem;">Failed to load videos: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function searchTelegramGlobal(query) {
    const q = String(query || '').trim();
    if (!q) {
      if (state.tgSearchAbort) {
        state.tgSearchAbort.abort();
        state.tgSearchAbort = null;
      }
      state.tgGlobalVideos = [];
      filterAndRenderChannels();
      return;
    }
    el.channelList.innerHTML = '<div class="helper-text" style="padding:1rem;">Searching Telegram videos...</div>';
    const signal = beginTgSearchAbort();
    try {
      const resp = await fetch(`/tg/videos?q=${encodeURIComponent(q)}`, {
        cache: 'no-store',
        signal
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const rawVideos = Array.isArray(data.videos) ? data.videos : [];
      state.tgGlobalVideos = mapTgVideos(rawVideos, '');
      filterAndRenderChannels();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      el.channelList.innerHTML = `<div class="helper-text" style="padding:1rem;">Global search failed: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadSeriesEpisodes(seriesItem) {
    const rawCreds = localStorage.getItem(STORAGE_KEYS.XTREAM_CREDS);
    if (!rawCreds) {
      showToast('Xtream Codes credentials required to load episodes');
      return;
    }
    const x = JSON.parse(rawCreds);
    const base = (x.url || '').replace(/\/+$/, '');
    const apiUrl = `${base}/player_api.php?username=${encodeURIComponent(x.user)}&password=${encodeURIComponent(x.pass)}&action=get_series_info&series_id=${encodeURIComponent(seriesItem.seriesId)}`;

    el.channelList.innerHTML = '<div class="helper-text" style="padding:1rem;">Loading episodes...</div>';
    try {
      const resp = await fetch(buildUrl(apiUrl));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const episodes = [];
      const seasons = data.episodes || {};
      Object.keys(seasons).sort((a, b) => Number(a) - Number(b)).forEach((seasonNum) => {
        const list = seasons[seasonNum] || [];
        list.forEach((ep) => {
          const ext = ep.container_extension || 'mp4';
          episodes.push({
            id: `ep_${ep.id}`,
            number: episodes.length + 1,
            name: `S${String(seasonNum).padStart(2, '0')}E${String(ep.episode_num || 1).padStart(2, '0')} - ${ep.title || seriesItem.name}`,
            logo: (ep.info && ep.info.movie_image) || seriesItem.logo || '',
            group: seriesItem.group,
            url: `${base}/series/${encodeURIComponent(x.user)}/${encodeURIComponent(x.pass)}/${ep.id}.${ext}`,
            contentType: 'series'
          });
        });
      });

      state.activeSeries = seriesItem;
      state.seriesEpisodes = episodes;
      el.seriesBackTitle.textContent = seriesItem.name;
      el.seriesBackBar.classList.remove('hidden');
      filterAndRenderChannels();
    } catch (err) {
      showToast(`Failed to load episodes: ${err.message}`);
      filterAndRenderChannels();
    }
  }

  function isCategoryLocked(category) {
    if (!state.pinCode || !category) return false;
    return state.lockedCategories.has(category) && !state.unlockedCategories.has(category);
  }

  function updatePinStatusUi() {
    if (state.pinCode) {
      el.pinStatusText.textContent = `Parental PIN is active (${state.lockedCategories.size} locked categories).`;
    } else {
      el.pinStatusText.textContent = 'Parental PIN is not configured.';
    }
    renderLockedCategoriesSetup();
  }

  function renderLockedCategoriesSetup() {
    if (!el.lockedCategoriesList) return;
    el.lockedCategoriesList.innerHTML = '';
    const allCats = new Set(state.categories);
    state.vodItems.forEach((v) => allCats.add(v.group));
    state.seriesItems.forEach((s) => allCats.add(s.group));

    const sorted = Array.from(allCats).sort();
    if (!sorted.length) {
      el.lockedCategoriesList.innerHTML = '<p class="helper-text">Load a playlist first to lock specific categories.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    sorted.forEach((cat) => {
      const isLocked = state.lockedCategories.has(cat);
      const btn = document.createElement('button');
      btn.className = 'locked-cat-item focusable' + (isLocked ? ' is-locked' : '');
      btn.tabIndex = 0;
      btn.innerHTML = `<span>${escapeHtml(cat)}</span><span class="pill-badge">${isLocked ? 'Locked' : 'Open'}</span>`;
      btn.addEventListener('click', () => {
        if (state.lockedCategories.has(cat)) state.lockedCategories.delete(cat);
        else state.lockedCategories.add(cat);
        localStorage.setItem(STORAGE_KEYS.LOCKED_CATS, JSON.stringify(Array.from(state.lockedCategories)));
        updatePinStatusUi();
        renderCategories();
      });
      frag.appendChild(btn);
    });
    el.lockedCategoriesList.appendChild(frag);
  }

  function promptPinUnlock(category, onSuccess) {
    state.pinBuffer = '';
    state.pinCallback = () => {
      state.unlockedCategories.add(category);
      if (onSuccess) onSuccess();
    };
    el.pinModalPrompt.textContent = `Enter 4-digit PIN to unlock "${category}".`;
    el.pinErrorText.classList.add('hidden');
    updatePinDots();
    el.pinModal.classList.remove('hidden');
    el.pinModal.setAttribute('aria-hidden', 'false');
    const firstKey = el.pinKeypad.querySelector('.pin-key');
    if (firstKey) firstKey.focus();
  }

  function closePinModal() {
    el.pinModal.classList.add('hidden');
    el.pinModal.setAttribute('aria-hidden', 'true');
    state.pinBuffer = '';
    state.pinCallback = null;
  }

  function updatePinDots() {
    const dots = el.pinDots.querySelectorAll('.pin-dot');
    dots.forEach((d, idx) => {
      d.classList.toggle('filled', idx < state.pinBuffer.length);
    });
  }

  function handlePinDigit(digit) {
    if (state.pinBuffer.length >= 4) return;
    state.pinBuffer += digit;
    el.pinErrorText.classList.add('hidden');
    updatePinDots();

    if (state.pinBuffer.length === 4) {
      if (state.pinBuffer === state.pinCode) {
        const cb = state.pinCallback;
        closePinModal();
        if (cb) cb();
      } else {
        el.pinErrorText.classList.remove('hidden');
        state.pinBuffer = '';
        setTimeout(updatePinDots, 250);
      }
    }
  }

  // Channel Drawer Rendering
  function renderCategories() {
    el.categoryList.innerHTML = '';

    if (state.contentMode === 'netshare') {
      const btn = document.createElement('button');
      btn.className = 'category-item focusable active';
      btn.tabIndex = 0;
      btn.innerHTML = `<span dir="auto">Network Folders</span><span class="pill-badge">${state.netShares.length}</span>`;
      btn.addEventListener('click', () => {
        state.activeNetShare = null;
        state.netShareSubpath = '';
        state.netShareFolders = [];
        state.netShareFiles = [];
        if (el.netshareBackBar) el.netshareBackBar.classList.add('hidden');
        filterAndRenderChannels();
      });
      el.categoryList.appendChild(btn);
      return;
    }

    if (state.contentMode === 'telegram') {
      const btn = document.createElement('button');
      btn.className = 'category-item focusable active';
      btn.tabIndex = 0;
      btn.innerHTML = `<span dir="auto">Telegram Channels</span><span class="pill-badge">${state.tgChannels.length}</span>`;
      btn.addEventListener('click', () => {
        state.activeTgChannel = null;
        state.tgVideos = [];
        if (el.telegramBackBar) el.telegramBackBar.classList.add('hidden');
        filterAndRenderChannels();
      });
      el.categoryList.appendChild(btn);
      return;
    }

    if (state.contentMode === 'favorites') {
      const btn = document.createElement('button');
      btn.className = 'category-item focusable' + (state.favFolderFilter === 'ALL' ? ' active' : '');
      btn.tabIndex = 0;
      btn.innerHTML = `<span dir="auto">All Favorites</span><span class="pill-badge">${state.favoriteStore.items.length}</span>`;
      btn.addEventListener('click', () => {
        state.favFolderFilter = 'ALL';
        renderCategories();
        filterAndRenderChannels();
      });
      el.categoryList.appendChild(btn);

      state.favoriteStore.folders.forEach((folder) => {
        const count = state.favoriteStore.items.filter((x) => (x.folderId || 'general') === folder.id).length;
        const fBtn = document.createElement('button');
        fBtn.className = 'category-item focusable' + (state.favFolderFilter === folder.id ? ' active' : '');
        fBtn.tabIndex = 0;
        fBtn.innerHTML = `<span dir="auto">${escapeHtml(folder.name)}</span><span class="pill-badge">${count}</span>`;
        fBtn.addEventListener('click', () => {
          state.favFolderFilter = folder.id;
          renderCategories();
          filterAndRenderChannels();
        });
        el.categoryList.appendChild(fBtn);
      });
      return;
    }

    const baseItems = getActiveModeItems();
    const catSet = new Set();
    for (let i = 0; i < baseItems.length; i++) {
      catSet.add(baseItems[i].group || 'Uncategorized');
    }

    const items = [
      { key: 'ALL', label: 'All', count: baseItems.length }
    ];
    if (state.contentMode === 'live') {
      items.push({ key: 'RECENT', label: 'Recently Watched', count: state.recents.length });
      items.push({ key: 'TELEGRAM_SOURCE', label: 'Telegram', count: state.tgChannels.length });
    }

    Array.from(catSet).forEach((cat) => {
      const count = baseItems.filter((c) => c.group === cat).length;
      items.push({ key: cat, label: cat, count });
    });

    const frag = document.createDocumentFragment();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const locked = isCategoryLocked(item.key);
      const btn = document.createElement('button');
      btn.className = 'category-item focusable' + (state.selectedCategory === item.key ? ' active' : '');
      btn.tabIndex = 0;
      btn.dataset.category = item.key;
      btn.innerHTML = `<span dir="auto">${locked ? '[PIN] ' : ''}${escapeHtml(item.label)}</span><span class="pill-badge">${item.count}</span>`;
      btn.addEventListener('click', () => {
        if (item.key === 'TELEGRAM_SOURCE') {
          setContentMode('telegram');
          return;
        }
        if (isCategoryLocked(item.key)) {
          promptPinUnlock(item.key, () => {
            state.selectedCategory = item.key;
            renderCategories();
            filterAndRenderChannels();
          });
          return;
        }
        state.selectedCategory = item.key;
        renderCategories();
        filterAndRenderChannels();
      });
      frag.appendChild(btn);
    }
    el.categoryList.appendChild(frag);
  }

  function renderTelegramDrawer() {
    const q = state.searchQuery.trim().toLowerCase();
    el.channelList.innerHTML = '';

    if (!state.tgAuthenticated) {
      el.drawerChannelCount.textContent = '0 items';
      const box = document.createElement('div');
      box.className = 'tg-drawer-empty';
      box.innerHTML = `
        <p class="helper-text">Connect your Telegram account in Setup to browse subscribed channels and stream videos.</p>
        <button id="tgDrawerConnectBtn" class="btn btn-primary btn-sm focusable" tabindex="0">Connect Telegram Account</button>
      `;
      box.querySelector('#tgDrawerConnectBtn').addEventListener('click', () => {
        closeDrawer();
        openSettings();
        const tgTab = el.settingsTabs.querySelector('[data-tab="tabTelegram"]');
        if (tgTab) tgTab.click();
      });
      el.channelList.appendChild(box);
      return;
    }

    if (!state.activeTgChannel) {
      if (q && state.tgGlobalVideos.length) {
        state.filteredChannels = state.tgGlobalVideos;
        el.drawerChannelCount.textContent = `${state.tgGlobalVideos.length.toLocaleString()} videos found`;
        renderChunkedList(el.channelList, state.tgGlobalVideos, (v) => {
          const isPlaying = state.currentChannel && state.currentChannel.id === v.id;
          const btn = document.createElement('button');
          btn.className = `channel-item focusable${isPlaying ? ' is-playing' : ''}`;
          btn.tabIndex = 0;
          const metaParts = [v.group];
          if (v.duration) metaParts.push(formatDurationClock(v.duration));
          if (v.size) metaParts.push(`${(v.size / (1024 * 1024)).toFixed(1)} MB`);
          const isFav = state.favorites.has(v.id);
          btn.innerHTML = `
            <span class="ch-num">${String(v.number).padStart(3, '0')}</span>
            <div class="ch-info">
              <div class="ch-title-row">
                <div class="ch-name" dir="auto">${escapeHtml(v.name)}</div>
                ${renderQualityBadgesHtml(v)}
              </div>
              <div class="ch-program" dir="auto">${escapeHtml(metaParts.join(' • '))}</div>
            </div>
            <span class="ch-fav focusable${isFav ? ' is-active' : ''}" role="button" tabindex="0" title="${isFav ? 'Manage Favorite Folder' : 'Add to Favorite Folder'}">${isFav ? '&#9733;' : '&#9734;'}</span>
          `;
          btn.addEventListener('click', (e) => {
            if (e.target && e.target.closest('.ch-fav')) {
              e.stopPropagation();
              openFavPicker(v);
              return;
            }
            playChannel(v, { isDirectStream: true });
            closeDrawer();
          });
          return btn;
        }, { batchSize: 60 });
        return;
      }

      let chList = state.tgChannels;
      if (q) {
        chList = chList.filter((c) =>
          (c.title || '').toLowerCase().includes(q) ||
          (c.username || '').toLowerCase().includes(q)
        );
      }
      el.drawerChannelCount.textContent = `${chList.length.toLocaleString()} channels`;
      if (!chList.length) {
        el.channelList.innerHTML = '<div class="helper-text" style="padding:1rem;">No subscribed Telegram channels found.</div>';
        return;
      }
      renderChunkedList(el.channelList, chList, (ch, i) => {
        const btn = document.createElement('button');
        btn.className = 'channel-item focusable';
        btn.tabIndex = 0;
        const sub = [
          ch.username ? `@${ch.username}` : '',
          ch.participantsCount ? `${ch.participantsCount.toLocaleString()} members` : ''
        ].filter(Boolean).join(' • ') || 'Telegram Channel';
        btn.innerHTML = `
          <span class="ch-num">${String(i + 1).padStart(3, '0')}</span>
          <div class="ch-info">
            <div class="ch-name" dir="auto">${escapeHtml(ch.title)}</div>
            <div class="ch-program" dir="auto">${escapeHtml(sub)}</div>
          </div>
        `;
        btn.addEventListener('click', () => loadTelegramVideos(ch, ''));
        return btn;
      }, { batchSize: 60 });
      return;
    }

    let vidList = state.tgVideos;
    if (q) {
      vidList = vidList.filter((v) => (v.name || '').toLowerCase().includes(q));
    }
    state.filteredChannels = vidList;
    el.drawerChannelCount.textContent = `${vidList.length.toLocaleString()} videos`;

    if (!vidList.length) {
      el.channelList.innerHTML = '<div class="helper-text" style="padding:1rem;">No matching videos in this channel.</div>';
      return;
    }

    renderChunkedList(el.channelList, vidList, (v, i) => {
      const isPlaying = state.currentChannel && state.currentChannel.id === v.id;
      const metaParts = [
        formatDurationSec(v.duration),
        formatFileSize(v.size),
        v.date ? new Date(v.date).toLocaleDateString() : ''
      ].filter(Boolean);
      const btn = document.createElement('button');
      btn.className = 'channel-item focusable' + (isPlaying ? ' playing' : '');
      btn.tabIndex = 0;
      const isFav = state.favorites.has(v.id);
      btn.innerHTML = `
        <span class="ch-num">${String(i + 1).padStart(3, '0')}</span>
        <div class="ch-info">
          <div class="ch-title-row">
            <div class="ch-name" dir="auto">${escapeHtml(v.name)}</div>
            ${renderQualityBadgesHtml(v)}
          </div>
          <div class="ch-program" dir="auto">${escapeHtml(metaParts.join(' • ') || 'Video')}</div>
        </div>
        <span class="ch-fav focusable${isFav ? ' is-active' : ''}" role="button" tabindex="0" title="${isFav ? 'Manage Favorite Folder' : 'Add to Favorite Folder'}">${isFav ? '&#9733;' : '&#9734;'}</span>
      `;
      btn.addEventListener('click', (e) => {
        if (e.target && e.target.closest('.ch-fav')) {
          e.stopPropagation();
          openFavPicker(v);
          return;
        }
        playChannel(v, { isDirectStream: true });
        closeDrawer();
      });
      return btn;
    }, { batchSize: 60 });
  }

  function renderFavFolderBar() {
    if (!el.favFolderBar) return;
    const show = state.contentMode === 'favorites';
    el.favFolderBar.classList.toggle('hidden', !show);
    if (!show) return;

    el.favFolderBar.innerHTML = '';
    const frag = document.createDocumentFragment();

    const makePill = (label, count, active, onClick, extraClass = '') => {
      const btn = document.createElement('button');
      btn.className = `fav-pill focusable${active ? ' active' : ''}${extraClass ? ' ' + extraClass : ''}`;
      btn.tabIndex = 0;
      const countHtml = count !== null ? `<span class="fav-pill-count">${count}</span>` : '';
      btn.innerHTML = `<span dir="auto">${escapeHtml(label)}</span>${countHtml}`;
      btn.addEventListener('click', onClick);
      return btn;
    };

    frag.appendChild(makePill('All Favorites', state.favoriteStore.items.length, state.activeFavFolderId === 'ALL', () => {
      state.activeFavFolderId = 'ALL';
      renderFavFolderBar();
      filterAndRenderChannels();
    }));

    for (const folder of state.favoriteStore.folders) {
      const cnt = state.favoriteStore.items.filter((i) => i.folderId === folder.id).length;
      frag.appendChild(makePill(folder.name, cnt, state.activeFavFolderId === folder.id, () => {
        state.activeFavFolderId = folder.id;
        renderFavFolderBar();
        filterAndRenderChannels();
      }));
    }

    frag.appendChild(makePill('+ New Folder', null, false, () => openFavFolderModal(null), 'fav-pill-action'));
    el.favFolderBar.appendChild(frag);
  }

  function openFavPicker(channel) {
    if (!channel) return;
    state.favPickerChannel = channel;
    openFavFolderModal(channel.id, channel);
  }

  function openFavFolderModal(moveItemKey = null, pickerChannel = null) {
    if (!el.favFolderModal) return;
    state.favMoveTargetKey = moveItemKey;
    state.favPickerChannel = pickerChannel || null;
    const isPicker = Boolean(moveItemKey);
    const alreadyFav = isPicker && state.favorites.has(moveItemKey);

    if (el.favModalTitle) {
      el.favModalTitle.textContent = isPicker ? 'Add to Favorite Folder' : 'Favorite Folders';
    }
    if (el.favModalSubtitle) {
      el.favModalSubtitle.textContent = pickerChannel
        ? `Choose a folder for "${pickerChannel.name}" or create a new one:`
        : (isPicker
          ? 'Select a destination folder or create a new folder below.'
          : 'Create, rename, or delete favorite folders. Deleted folders move items to General.');
    }
    if (el.favCreateFolderBtn) {
      el.favCreateFolderBtn.textContent = isPicker ? '+ Create & Add' : 'Create';
    }
    if (el.favRemoveItemBtn) {
      el.favRemoveItemBtn.classList.toggle('hidden', !alreadyFav);
    }
    setFavFolderValidation('');
    if (el.favNewFolderInput) el.favNewFolderInput.value = '';
    renderFavFolderManagerList();
    el.favFolderModal.classList.remove('hidden');
    el.favFolderModal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      const target = !isPicker
        ? (el.favNewFolderInput || el.favFolderManagerList.querySelector('.focusable'))
        : (el.favFolderManagerList.querySelector('.focusable') || el.favNewFolderInput);
      if (target) target.focus();
    });
  }

  function closeFavFolderModal() {
    if (!el.favFolderModal) return;
    state.favMoveTargetKey = null;
    state.favPickerChannel = null;
    el.favFolderModal.classList.add('hidden');
    el.favFolderModal.setAttribute('aria-hidden', 'true');
    const focusBack = el.favFolderBar && !el.favFolderBar.classList.contains('hidden')
      ? el.favFolderBar.querySelector('.focusable')
      : el.channelList.querySelector('.focusable');
    if (focusBack) focusBack.focus();
  }

  function renderFavFolderManagerList() {
    if (!el.favFolderManagerList) return;
    el.favFolderManagerList.innerHTML = '';
    const frag = document.createDocumentFragment();
    const existingEntry = state.favMoveTargetKey
      ? state.favoriteStore.items.find((i) => i.key === state.favMoveTargetKey)
      : null;

    for (const folder of state.favoriteStore.folders) {
      const count = state.favoriteStore.items.filter((i) => i.folderId === folder.id).length;
      const isCurrentFolder = Boolean(existingEntry && existingEntry.folderId === folder.id);
      const row = document.createElement('div');
      row.className = 'fav-folder-row';

      const info = document.createElement('div');
      info.className = 'fav-folder-row-info';
      info.innerHTML = `<span class="fav-folder-row-name" dir="auto">${isCurrentFolder ? '✓ ' : ''}${escapeHtml(folder.name)}</span><span class="pill-badge">${count}</span>`;
      row.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'fav-folder-row-actions';

      if (state.favMoveTargetKey) {
        const moveBtn = document.createElement('button');
        moveBtn.className = `btn ${isCurrentFolder ? 'btn-secondary' : 'btn-primary'} btn-sm focusable`;
        moveBtn.tabIndex = 0;
        moveBtn.textContent = isCurrentFolder ? 'Selected' : (state.favPickerChannel ? 'Add Here' : 'Move Here');
        moveBtn.addEventListener('click', () => {
          if (state.favPickerChannel) {
            assignChannelToFavoriteFolder(state.favPickerChannel, folder.id);
          } else {
            moveFavoriteItemToFolder(state.favMoveTargetKey, folder.id);
          }
          closeFavFolderModal();
        });
        actions.appendChild(moveBtn);
      } else {
        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-secondary btn-sm focusable';
        openBtn.tabIndex = 0;
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => {
          state.activeFavFolderId = folder.id;
          closeFavFolderModal();
          renderFavFolderBar();
          filterAndRenderChannels();
        });
        actions.appendChild(openBtn);
      }

      if (folder.id !== 'general') {
        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn btn-secondary btn-sm focusable';
        renameBtn.tabIndex = 0;
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'tv-input focusable';
          input.dir = 'auto';
          input.value = folder.name;
          input.maxLength = 40;
          const saveBtn = document.createElement('button');
          saveBtn.className = 'btn btn-primary btn-sm focusable';
          saveBtn.tabIndex = 0;
          saveBtn.textContent = 'Save';
          const commit = () => renameFavoriteFolder(folder.id, input.value);
          saveBtn.addEventListener('click', commit);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); renderFavFolderManagerList(); }
          });
          info.innerHTML = '';
          info.appendChild(input);
          actions.innerHTML = '';
          actions.appendChild(saveBtn);
          input.focus();
        });
        actions.appendChild(renameBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm focusable';
        delBtn.tabIndex = 0;
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => deleteFavoriteFolder(folder.id));
        actions.appendChild(delBtn);
      }

      row.appendChild(actions);
      frag.appendChild(row);
    }

    el.favFolderManagerList.appendChild(frag);
  }

  function resolveFavoriteListItems() {
    const byId = new Map();
    for (const c of state.channels) byId.set(c.id, c);
    for (const v of state.vodItems) byId.set(v.id, v);
    for (const s of state.seriesItems) byId.set(s.id, s);
    for (const t of state.tgVideos) byId.set(t.id, t);

    const folderMap = new Map(state.favoriteStore.folders.map((f) => [f.id, f.name]));
    const out = [];
    for (const entry of state.favoriteStore.items) {
      if (state.activeFavFolderId !== 'ALL' && entry.folderId !== state.activeFavFolderId) continue;
      const resolved = byId.get(entry.key) || entry.channelData;
      if (!resolved) continue;
      out.push({
        ...resolved,
        favFolderId: entry.folderId,
        favFolderName: folderMap.get(entry.folderId) || 'General'
      });
    }
    return out;
  }

  function renderChunkedList(container, items, buildItemFn, options = {}) {
    if (!container) return;
    if (typeof container._chunkCleanup === 'function') {
      container._chunkCleanup();
      container._chunkCleanup = null;
    }
    if (!options.preserveExisting) {
      container.innerHTML = '';
    }
    if (!items || !items.length) return;

    const batchSize = options.batchSize || 60;
    let offset = 0;
    let disposed = false;

    const appendBatch = () => {
      if (disposed || offset >= items.length) return false;
      const end = Math.min(items.length, offset + batchSize);
      const frag = document.createDocumentFragment();
      for (let i = offset; i < end; i++) {
        const node = buildItemFn(items[i], i);
        if (node) frag.appendChild(node);
      }
      offset = end;
      container.appendChild(frag);
      return offset < items.length;
    };

    if (!appendBatch()) return;

    const cleanup = () => {
      disposed = true;
      container.removeEventListener('scroll', onScroll);
    };

    const onScroll = () => {
      if (disposed) return;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 280) {
        if (!appendBatch()) {
          cleanup();
        }
      }
    };

    container._chunkCleanup = cleanup;
    container.addEventListener('scroll', onScroll, { passive: true });

    requestAnimationFrame(() => {
      if (!disposed && container.scrollHeight <= container.clientHeight + 40) {
        if (!appendBatch()) cleanup();
      }
    });
  }

  function filterAndRenderChannels() {
    if (state.contentMode === 'netshare') {
      if (el.favFolderBar) el.favFolderBar.classList.add('hidden');
      renderNetShareDrawer();
      return;
    }

    if (state.contentMode === 'telegram') {
      if (el.favFolderBar) el.favFolderBar.classList.add('hidden');
      renderTelegramDrawer();
      return;
    }
    renderFavFolderBar();
    const q = state.searchQuery.trim().toLowerCase();
    let list = getActiveModeItems();

    if (state.contentMode === 'favorites') {
      list = resolveFavoriteListItems();
    } else if (state.selectedCategory === 'RECENT') {
      const byId = new Map(state.channels.map((c) => [c.id, c]));
      list = state.recents.map((id) => byId.get(id) || state.recentItems[id]).filter(Boolean);
    } else if (state.selectedCategory !== 'ALL') {
      list = list.filter((c) => c.group === state.selectedCategory);
    }

    if (q) {
      list = list.filter((c) => {
        const title = (cleanChannelTitle(c.name) || c.name || '').toLowerCase();
        return title.includes(q) ||
          (c.group || '').toLowerCase().includes(q) ||
          String(c.number).includes(q);
      });
    }

    state.filteredChannels = list;
    el.drawerChannelCount.textContent = `${list.length.toLocaleString()} items`;

    if (list.length === 0) {
      if (typeof el.channelList._chunkCleanup === 'function') {
        el.channelList._chunkCleanup();
        el.channelList._chunkCleanup = null;
      }
      const emptyMsg = state.contentMode === 'favorites' ? 'No favorites saved yet' : 'No items found';
      el.channelList.innerHTML = `<div class="helper-text" style="padding:1rem;">${emptyMsg}</div>`;
      return;
    }

    renderChunkedList(el.channelList, list, (ch) => {
      const isPlaying = state.currentChannel && state.currentChannel.id === ch.id;
      const isFav = state.favorites.has(ch.id);
      const { now } = state.contentMode === 'live' ? getNowAndNext(ch) : { now: null };
      const subLabel = state.selectedCategory === 'FAVORITES'
        ? `${ch.favFolderName || 'General'} • ${ch.group || 'Media'}`
        : (state.contentMode === 'catchup'
          ? `${ch.catchupDays || 7}d Archive • Open Guide for past shows`
          : (now ? now.title : (ch.group || 'Media')));

      const btn = document.createElement('button');
      btn.className = 'channel-item focusable' + (isPlaying ? ' playing' : '');
      btn.tabIndex = 0;
      btn.dataset.channelId = ch.id;

      const cleanName = cleanChannelTitle(ch.name) || ch.name || 'Channel';
      const monogram = cleanName.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'TV';
      const logoHtml = ch.logo
        ? `<div class="ch-logo-wrap"><img class="ch-logo" src="${escapeHtml(buildUrl(ch.logo))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.classList.add('hidden');if(this.nextElementSibling)this.nextElementSibling.classList.remove('hidden');"><span class="ch-logo-fallback hidden">${escapeHtml(monogram)}</span></div>`
        : `<div class="ch-logo-wrap"><span class="ch-logo-fallback">${escapeHtml(monogram)}</span></div>`;

      const epgProgressHtml = (now && now.stop > now.start)
        ? `<div class="ch-epg-progress"><div class="ch-epg-progress-fill" style="width:${Math.max(0, Math.min(100, ((Date.now() - now.start) / (now.stop - now.start)) * 100)).toFixed(1)}%"></div></div>`
        : '';

      btn.innerHTML = `
        <span class="ch-num">${String(ch.number).padStart(3, '0')}</span>
        ${logoHtml}
        <div class="ch-info">
          <div class="ch-title-row">
            <div class="ch-name" dir="auto">${escapeHtml(cleanName)}</div>
            ${renderQualityBadgesHtml(ch)}
          </div>
          <div class="ch-program" dir="auto">${escapeHtml(subLabel)}</div>
          ${epgProgressHtml}
        </div>
        ${state.selectedCategory === 'FAVORITES' ? '<span class="btn btn-secondary btn-sm fav-move-btn" title="Move to folder">Folder</span>' : ''}
        <span class="ch-fav focusable${isFav ? ' is-active' : ''}" role="button" tabindex="0" title="${isFav ? 'Manage Favorite Folder' : 'Add to Favorite Folder'}">${isFav ? '&#9733;' : '&#9734;'}</span>
      `;

      btn.addEventListener('click', (e) => {
        if (e.target && e.target.closest('.ch-fav')) {
          e.stopPropagation();
          openFavPicker(ch);
          return;
        }
        if (e.target && e.target.closest('.fav-move-btn')) {
          e.stopPropagation();
          openFavPicker(ch);
          return;
        }
        if (ch.isNetShareFolder) {
          const share = state.netShares.find((s) => s.id === ch.netShareId) || {
            id: ch.netShareId,
            name: ch.group || 'Network Share'
          };
          setContentMode('netshare');
          browseNetShare(share, ch.netShareSubpath || '');
          return;
        }
        if ((state.contentMode === 'series' && !state.activeSeries) || ch.contentType === 'series') {
          loadSeriesEpisodes(ch);
          return;
        }
        if (state.contentMode === 'catchup') {
          state.epgWindowStart = getFloorHalfHour(Date.now() - 2 * 60 * 60 * 1000);
          openEpg();
          return;
        }
        playChannel(ch, { isDirectStream: Boolean(ch.isTelegramVideo || ch.isDirectStream) });
        closeDrawer();
      });

      return btn;
    }, { batchSize: 60 });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // EPG Grid Rendering
  function getFloorHalfHour(ms) {
    const d = new Date(ms);
    d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
    return d.getTime();
  }

  async function loadDvrSchedulesFromServer() {
    try {
      const resp = await fetch('/dvr/schedules', { cache: 'no-store' });
      if (!resp.ok) return;
      const data = await resp.json();
      state.dvrSchedules = Array.isArray(data.schedules) ? data.schedules : [];
    } catch (_) {}
  }

  function findScheduledDvrForProgram(ch, p) {
    if (!ch || !p || !Array.isArray(state.dvrSchedules)) return null;
    const chId = String(ch.id || '');
    const chName = cleanChannelTitle(ch.name) || ch.name || '';
    const title = String(p.title || '').trim();
    return state.dvrSchedules.find((s) =>
      s &&
      (s.status === 'scheduled' || s.status === 'recording') &&
      Math.abs(Number(s.startTime) - p.start) < 60000 &&
      (s.channelId === chId || s.channelName === chName) &&
      (!title || s.programTitle === title)
    ) || null;
  }

  function formatDvrDefaultFileName(programTitle, startMs) {
    const cleanTitle = String(programTitle || 'Recording')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) || 'Recording';
    const d = new Date(startMs);
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
    return `${cleanTitle}_${stamp}.ts`;
  }

  function createDvrProgramButton(ch, p) {
    const scheduled = findScheduledDvrForProgram(ch, p);
    const btn = document.createElement('span');
    btn.setAttribute('role', 'button');
    btn.tabIndex = 0;
    btn.className = 'epg-prog-dvr-btn focusable' + (scheduled ? ' is-scheduled' : '');
    btn.title = scheduled ? 'Cancel Scheduled Recording' : 'Schedule Recording';
    btn.innerHTML = scheduled
      ? `<svg class="ui-icon" style="width:12px;height:12px" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg><span>Cancel Recording</span>`
      : `<svg class="ui-icon" style="width:12px;height:12px" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg><span>Record</span>`;

    const trigger = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (scheduled) {
        openDvrCancelModal(scheduled);
      } else if (p.stop <= Date.now()) {
        openDvrCatchupNoticeModal(ch, p);
      } else {
        openDvrSetupModal(ch, p, { isCatchupImmediate: false });
      }
    };
    btn.addEventListener('click', trigger);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') trigger(e);
    });
    return btn;
  }

  function ensureDvrCatchupNoticeModal() {
    let modal = document.getElementById('dvrCatchupNoticeModal');
    if (modal) return modal;
    modal = document.createElement('section');
    modal.id = 'dvrCatchupNoticeModal';
    modal.className = 'modal-backdrop hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'dvrCatchupNoticeTitle');
    modal.innerHTML = `
      <div class="dvr-modal-panel">
        <h2 id="dvrCatchupNoticeTitle">Record Past Catch-up Program</h2>
        <p class="helper-text">Recording a past program will tune the player to its Catch-up stream and begin recording immediately once confirmed.</p>
        <div class="dvr-summary-box">
          <div><span>Program</span><strong id="dvrCatchupNoticeProgram" dir="auto"></strong></div>
          <div><span>Channel</span><strong id="dvrCatchupNoticeChannel" dir="auto"></strong></div>
          <div><span>Day &amp; Date</span><strong id="dvrCatchupNoticeDate"></strong></div>
          <div><span>Time</span><strong id="dvrCatchupNoticeTime"></strong></div>
        </div>
        <div class="dvr-modal-actions">
          <button id="dvrCatchupNoticeCancelBtn" class="btn btn-secondary focusable" tabindex="0">Cancel</button>
          <button id="dvrCatchupNoticeContinueBtn" class="btn btn-primary focusable" tabindex="0">Continue</button>
        </div>
      </div>
    `;
    const appRoot = document.getElementById('app') || document.body;
    appRoot.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDvrCatchupNoticeModal();
    });
    modal.querySelector('#dvrCatchupNoticeCancelBtn').addEventListener('click', closeDvrCatchupNoticeModal);
    modal.querySelector('#dvrCatchupNoticeContinueBtn').addEventListener('click', () => {
      const pending = state.dvrCatchupNoticeTarget;
      closeDvrCatchupNoticeModal();
      if (pending) {
        openDvrSetupModal(pending.ch, pending.p, { isCatchupImmediate: true });
      }
    });
    return modal;
  }

  function openDvrCatchupNoticeModal(ch, p) {
    if (!ch || !p) return;
    const modal = ensureDvrCatchupNoticeModal();
    state.dvrCatchupNoticeTarget = { ch, p };
    const cleanCh = cleanChannelTitle(ch.name) || ch.name || 'Channel';
    modal.querySelector('#dvrCatchupNoticeProgram').textContent = p.title || 'Catch-up Program';
    modal.querySelector('#dvrCatchupNoticeChannel').textContent = cleanCh;
    modal.querySelector('#dvrCatchupNoticeDate').textContent = formatProgramDayBadge(p.start);
    modal.querySelector('#dvrCatchupNoticeTime').textContent = `${formatTime(p.start)} – ${formatTime(p.stop)}`;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('#dvrCatchupNoticeContinueBtn').focus();
  }

  function closeDvrCatchupNoticeModal() {
    const modal = document.getElementById('dvrCatchupNoticeModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    state.dvrCatchupNoticeTarget = null;
  }

  async function openDvrSetupModal(ch, p, options = {}) {
    if (!el.dvrScheduleModal || !ch || !p) return;
    state.dvrPendingTarget = { ch, p, isCatchupImmediate: Boolean(options.isCatchupImmediate) };
    const cleanCh = cleanChannelTitle(ch.name) || ch.name || 'Channel';
    if (el.dvrSetupProgramLabel) {
      el.dvrSetupProgramLabel.textContent = `${p.title || 'Program'} • ${cleanCh} (${formatProgramDayBadge(p.start)} ${formatTime(p.start)} – ${formatTime(p.stop)})`;
    }
    if (el.dvrFileNameInput) {
      el.dvrFileNameInput.value = formatDvrDefaultFileName(p.title, p.start);
    }
    if (el.dvrSaveDirInput && !el.dvrSaveDirInput.value.trim()) {
      el.dvrSaveDirInput.value = 'Recordings';
      try {
        const resp = await fetch('/dvr/default-dir', { cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.dir) el.dvrSaveDirInput.value = data.dir;
        }
      } catch (_) {}
    }
    if (el.dvrStepSetup) el.dvrStepSetup.classList.remove('hidden');
    if (el.dvrStepConfirm) el.dvrStepConfirm.classList.add('hidden');
    el.dvrScheduleModal.classList.remove('hidden');
    el.dvrScheduleModal.setAttribute('aria-hidden', 'false');
    if (el.dvrSaveDirInput) el.dvrSaveDirInput.focus();
  }

  function showDvrConfirmStep() {
    const target = state.dvrPendingTarget;
    if (!target || !el.dvrScheduleModal) return;
    const { ch, p } = target;
    const saveDir = (el.dvrSaveDirInput ? el.dvrSaveDirInput.value : '').trim() || 'Recordings';
    let fileName = (el.dvrFileNameInput ? el.dvrFileNameInput.value : '').trim() || formatDvrDefaultFileName(p.title, p.start);
    if (!/\.(ts|mp4)$/i.test(fileName)) fileName += '.ts';
    if (el.dvrFileNameInput) el.dvrFileNameInput.value = fileName;

    const cleanCh = cleanChannelTitle(ch.name) || ch.name || 'Channel';
    const sep = saveDir.includes('/') && !saveDir.includes('\\') ? '/' : '\\';
    const fullPath = `${saveDir.replace(/[\\/]+$/, '')}${sep}${fileName}`;

    if (el.dvrConfirmProgram) el.dvrConfirmProgram.textContent = p.title || 'Scheduled Recording';
    if (el.dvrConfirmChannel) el.dvrConfirmChannel.textContent = cleanCh;
    if (el.dvrConfirmDate) el.dvrConfirmDate.textContent = formatProgramDayBadge(p.start);
    if (el.dvrConfirmTime) el.dvrConfirmTime.textContent = `${formatTime(p.start)} – ${formatTime(p.stop)}`;
    if (el.dvrConfirmPath) el.dvrConfirmPath.textContent = fullPath;

    if (el.dvrConfirmSubmitBtn) {
      el.dvrConfirmSubmitBtn.textContent = target.isCatchupImmediate ? 'Confirm Recording' : 'Confirm Schedule';
    }
    if (el.dvrStepSetup) el.dvrStepSetup.classList.add('hidden');
    if (el.dvrStepConfirm) el.dvrStepConfirm.classList.remove('hidden');
    if (el.dvrConfirmSubmitBtn) el.dvrConfirmSubmitBtn.focus();
  }

  function closeDvrScheduleModal() {
    if (!el.dvrScheduleModal) return;
    el.dvrScheduleModal.classList.add('hidden');
    el.dvrScheduleModal.setAttribute('aria-hidden', 'true');
    state.dvrPendingTarget = null;
  }

  async function submitDvrSchedule() {
    const target = state.dvrPendingTarget;
    if (!target) return;
    const { ch, p, isCatchupImmediate } = target;
    const saveDir = (el.dvrSaveDirInput ? el.dvrSaveDirInput.value : '').trim();
    const fileName = (el.dvrFileNameInput ? el.dvrFileNameInput.value : '').trim();
    let streamUrl = ch.url;
    if (isCatchupImmediate) {
      showToast('Resolving Catch-up stream...', 2000);
      const resolved = await resolveCatchupStream(ch, p);
      if (!resolved.ok) {
        showToast(`Catch-up unavailable: ${resolved.error}`, 5000);
        return;
      }
      streamUrl = resolved.url;
    }
    if (!streamUrl) {
      showToast('Channel stream URL is missing.');
      return;
    }
    try {
      const resp = await fetch('/dvr/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: ch.id || '',
          channelName: cleanChannelTitle(ch.name) || ch.name || 'Channel',
          streamUrl,
          programTitle: p.title || 'Scheduled Recording',
          startTime: p.start,
          endTime: p.stop,
          immediate: Boolean(isCatchupImmediate),
          saveDir,
          fileName
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      await loadDvrSchedulesFromServer();
      closeDvrScheduleModal();
      if (isCatchupImmediate) {
        playChannel(ch, { overrideUrl: streamUrl, isCatchup: true, programTitle: p.title });
      }
      if (el.epgOverlay && !el.epgOverlay.classList.contains('hidden')) renderEpgGrid();
      if (el.splitGuidePanel && !el.splitGuidePanel.classList.contains('hidden')) renderSplitGuide();
      showToast(isCatchupImmediate ? `Tuned & recording started: ${p.title}` : `Scheduled recording: ${p.title}`);
    } catch (err) {
      showToast(`Schedule failed: ${err.message}`);
    }
  }

  function openDvrCancelModal(schedule) {
    if (!el.dvrCancelModal || !schedule) return;
    state.dvrPendingCancelSchedule = schedule;
    const sep = (schedule.saveDir || '').includes('/') && !(schedule.saveDir || '').includes('\\') ? '/' : '\\';
    const fullPath = `${String(schedule.saveDir || '').replace(/[\\/]+$/, '')}${sep}${schedule.fileName || ''}`;
    if (el.dvrCancelProgram) el.dvrCancelProgram.textContent = schedule.programTitle || 'Scheduled Recording';
    if (el.dvrCancelTime) el.dvrCancelTime.textContent = `${formatProgramDayBadge(schedule.startTime)} ${formatTime(schedule.startTime)} – ${formatTime(schedule.endTime)}`;
    if (el.dvrCancelPath) el.dvrCancelPath.textContent = fullPath;
    el.dvrCancelModal.classList.remove('hidden');
    el.dvrCancelModal.setAttribute('aria-hidden', 'false');
    if (el.dvrKeepBtn) el.dvrKeepBtn.focus();
  }

  function closeDvrCancelModal() {
    if (!el.dvrCancelModal) return;
    el.dvrCancelModal.classList.add('hidden');
    el.dvrCancelModal.setAttribute('aria-hidden', 'true');
    state.dvrPendingCancelSchedule = null;
  }

  async function submitDvrCancel() {
    const schedule = state.dvrPendingCancelSchedule;
    if (!schedule) return;
    try {
      const resp = await fetch('/dvr/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: schedule.id })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      await loadDvrSchedulesFromServer();
      closeDvrCancelModal();
      if (el.epgOverlay && !el.epgOverlay.classList.contains('hidden')) renderEpgGrid();
      if (el.splitGuidePanel && !el.splitGuidePanel.classList.contains('hidden')) renderSplitGuide();
      showToast(`Cancelled recording: ${schedule.programTitle}`);
    } catch (err) {
      showToast(`Cancel failed: ${err.message}`);
    }
  }

  function formatProgramDayBadge(tsMs) {
    return new Date(tsMs).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  function getDayWindowBounds(dayOffset) {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + dayOffset);
    const startOfDay = base.getTime();
    return { startOfDay, endOfDay: startOfDay + 86400000 };
  }

  function buildSevenDayStrip(containerEl, selectedOffset, onSelect) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let offset = 0; offset >= -6; offset--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offset);
      const dateStr = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const label = offset === 0
        ? `Today (${dateStr})`
        : (offset === -1 ? `Yesterday (${dateStr})` : dateStr);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'epg-day-btn focusable' + (selectedOffset === offset ? ' active' : '');
      btn.tabIndex = 0;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', selectedOffset === offset ? 'true' : 'false');
      btn.textContent = label;
      btn.addEventListener('click', () => onSelect(offset));
      frag.appendChild(btn);
    }
    containerEl.appendChild(frag);
  }

  function renderEpgGrid() {
    const windowMs = 2 * 60 * 60 * 1000; // 2-hour grid window
    if (!state.epgWindowStart) {
      state.epgWindowStart = getFloorHalfHour(Date.now());
    }
    const startMs = state.epgWindowStart;
    const endMs = startMs + windowMs;

    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);
    const winZero = new Date(startMs);
    winZero.setHours(0, 0, 0, 0);
    state.epgSelectedDayOffset = Math.round((winZero.getTime() - todayZero.getTime()) / 86400000);

    buildSevenDayStrip(el.epgDayBar, state.epgSelectedDayOffset, (offset) => {
      state.epgSelectedDayOffset = offset;
      if (offset === 0) {
        state.epgWindowStart = getFloorHalfHour(Date.now());
      } else {
        const { startOfDay } = getDayWindowBounds(offset);
        state.epgWindowStart = startOfDay + 20 * 60 * 60 * 1000; // Prime-time 20:00 default on past days
      }
      renderEpgGrid();
    });

    el.epgDateLabel.textContent = formatProgramDayBadge(startMs);

    el.epgGrid.innerHTML = '';

    // Header row
    const header = document.createElement('div');
    header.className = 'epg-time-header';
    const corner = document.createElement('div');
    corner.className = 'epg-corner';
    corner.textContent = 'Channels';
    header.appendChild(corner);

    const slotsWrap = document.createElement('div');
    slotsWrap.className = 'epg-timeline-slots';
    for (let s = 0; s < 4; s++) {
      const slot = document.createElement('div');
      slot.className = 'epg-time-slot';
      slot.textContent = formatTime(startMs + s * 30 * 60000);
      slotsWrap.appendChild(slot);
    }
    header.appendChild(slotsWrap);
    el.epgGrid.appendChild(header);

    const sourceList = state.filteredChannels.length ? state.filteredChannels : state.channels;
    const nowMs = Date.now();

    renderChunkedList(el.epgGrid, sourceList, (ch) => {
      const row = document.createElement('div');
      row.className = 'epg-row';

      const chCol = document.createElement('div');
      chCol.className = 'epg-row-channel';
      chCol.innerHTML = `<span class="ch-num">${String(ch.number).padStart(3, '0')}</span><span class="ch-name" dir="auto">${escapeHtml(cleanChannelTitle(ch.name) || ch.name)}</span>`;
      row.appendChild(chCol);

      const progCol = document.createElement('div');
      progCol.className = 'epg-row-programs';

      const allChProgs = getChannelPrograms(ch);
      const progs = allChProgs.filter((p) => p.stop > startMs && p.start < endMs);
      if (!progs.length) {
        const nextToday = allChProgs.find((p) => p.start >= endMs && p.start < startMs + 24 * 3600 * 1000);
        const emptyBlock = document.createElement('button');
        emptyBlock.className = 'epg-prog-block focusable';
        emptyBlock.style.width = '100%';
        emptyBlock.tabIndex = 0;
        if (nextToday) {
          emptyBlock.innerHTML = `<span class="epg-prog-title" dir="auto">Next: ${escapeHtml(nextToday.title)}</span><span class="epg-prog-time" dir="auto">${formatTime(nextToday.start)} - ${formatTime(nextToday.stop)} (Click to jump)</span>`;
          emptyBlock.addEventListener('focus', () => selectEpgDetail(ch, nextToday));
          emptyBlock.addEventListener('click', () => {
            state.epgWindowStart = getFloorHalfHour(nextToday.start);
            renderEpgGrid();
          });
        } else {
          emptyBlock.innerHTML = `<span class="epg-prog-title" dir="auto">No EPG Data</span><span class="epg-prog-time" dir="auto">${escapeHtml(ch.group)}</span>`;
          emptyBlock.addEventListener('focus', () => selectEpgDetail(ch, null));
          emptyBlock.addEventListener('click', () => {
            playChannel(ch);
            closeEpg();
          });
        }
        progCol.appendChild(emptyBlock);
      } else {
        for (let j = 0; j < progs.length; j++) {
          const p = progs[j];
          const clampedStart = Math.max(startMs, p.start);
          const clampedEnd = Math.min(endMs, p.stop);
          const widthPct = ((clampedEnd - clampedStart) / windowMs) * 100;
          const isLive = p.start <= nowMs && p.stop > nowMs;
          const canCatchup = p.stop <= nowMs && hasCatchupSupport(ch);

          const block = document.createElement('button');
          block.className = 'epg-prog-block focusable' + (isLive ? ' is-live' : '') + (canCatchup ? ' is-past' : '');
          block.style.width = `${widthPct.toFixed(2)}%`;
          block.tabIndex = 0;
          block.innerHTML = `
            <span class="epg-prog-title" dir="auto">${canCatchup ? '[Catch-up] ' : ''}${escapeHtml(p.title)}</span>
            <span class="epg-prog-time"><span class="epg-prog-day-badge">${escapeHtml(formatProgramDayBadge(p.start))}</span> ${formatTime(p.start)} - ${formatTime(p.stop)}</span>
          `;
          if (p.start > nowMs || (canCatchup && p.stop >= nowMs - 7 * 86400000)) {
            const timeRow = block.querySelector('.epg-prog-time');
            if (timeRow) timeRow.appendChild(createDvrProgramButton(ch, p));
          }
          block.addEventListener('focus', () => selectEpgDetail(ch, p));
          block.addEventListener('click', () => {
            selectEpgDetail(ch, p);
            if (canCatchup) {
              if (playCatchupProgram(ch, p)) {
                closeEpg();
                return;
              }
            }
            playChannel(ch);
            closeEpg();
          });
          progCol.appendChild(block);
        }
      }

      row.appendChild(progCol);
      return row;
    }, { batchSize: 60, preserveExisting: true });
  }

  function selectEpgDetail(channel, program) {
    state.epgSelectedChannel = channel;
    state.epgSelectedProgram = program || null;
    const canCatchup = program && program.stop <= Date.now() && hasCatchupSupport(channel);
    el.epgWatchBtn.textContent = canCatchup ? 'Play Catch-up' : 'Watch Channel';
    el.epgDetailChannel.dir = 'auto';
    el.epgDetailTitle.dir = 'auto';
    el.epgDetailDesc.dir = 'auto';
    el.epgDetailChannel.textContent = `${String(channel.number).padStart(3, '0')} • ${channel.name}`;
    if (program) {
      el.epgDetailTitle.textContent = program.title;
      el.epgDetailTime.textContent = `${formatTime(program.start)} - ${formatTime(program.stop)}`;
      el.epgDetailDesc.textContent = program.desc || 'No program description available.';
      const remId = `${channel.id}::${program.start}`;
      const hasRem = state.reminders.some((r) => r.id === remId);
      el.epgReminderBtn.textContent = hasRem ? 'Cancel Reminder' : 'Set Reminder';
      el.epgReminderBtn.disabled = program.start <= Date.now();
    } else {
      el.epgDetailTitle.textContent = channel.name;
      el.epgDetailTime.textContent = '';
      el.epgDetailDesc.textContent = 'Press Enter or click Watch Channel to tune to this channel.';
      el.epgReminderBtn.textContent = 'Set Reminder';
      el.epgReminderBtn.disabled = true;
    }
  }

  async function toggleReminderForSelection() {
    const ch = state.epgSelectedChannel;
    const prog = state.epgSelectedProgram;
    if (!ch || !prog || prog.start <= Date.now()) {
      showToast('Select an upcoming program to set a reminder');
      return;
    }
    const remId = `${ch.id}::${prog.start}`;
    const existingIdx = state.reminders.findIndex((r) => r.id === remId);
    if (existingIdx >= 0) {
      state.reminders.splice(existingIdx, 1);
      await dbSet('reminders', state.reminders);
      el.epgReminderBtn.textContent = 'Set Reminder';
      showToast(`Cancelled reminder for "${prog.title}"`);
      return;
    }
    const reminder = {
      id: remId,
      channelId: ch.id,
      channelName: ch.name,
      programTitle: prog.title,
      start: prog.start,
      stop: prog.stop,
      autoTune: Boolean(el.epgReminderAutoTune.checked)
    };
    state.reminders.push(reminder);
    await dbSet('reminders', state.reminders);
    el.epgReminderBtn.textContent = 'Cancel Reminder';
    showToast(`Reminder set for "${prog.title}" at ${formatTime(prog.start)}`);
  }

  async function checkDueReminders() {
    if (!state.reminders.length) return;
    const nowMs = Date.now();
    let due = [];
    let upcoming = [];
    if (window.Worker) {
      try {
        const res = await runWorkerTask('partitionReminders', { reminders: state.reminders, nowMs });
        due = res.due || [];
        upcoming = res.upcoming || [];
      } catch {
        due = state.reminders.filter((r) => r.start <= nowMs && r.stop > nowMs);
        upcoming = state.reminders.filter((r) => r.start > nowMs);
      }
    } else {
      due = state.reminders.filter((r) => r.start <= nowMs && r.stop > nowMs);
      upcoming = state.reminders.filter((r) => r.start > nowMs);
    }

    if (due.length > 0 || upcoming.length !== state.reminders.length) {
      state.reminders = upcoming;
      await dbSet('reminders', state.reminders);
    }

    if (due.length > 0) {
      const first = due[0];
      showToast(`Reminder: "${first.programTitle}" starting on ${first.channelName}`, 5500);
      if (first.autoTune) {
        const target = state.channels.find((c) => c.id === first.channelId);
        if (target) {
          closeEpg();
          closeDrawer();
          closeSettings();
          playChannel(target);
        }
      }
    }
  }

  // Overlays Open / Close
  function isAnyOverlayOpen() {
    const catchupNoticeModal = document.getElementById('dvrCatchupNoticeModal');
    return (
      (catchupNoticeModal && !catchupNoticeModal.classList.contains('hidden')) ||
      (el.dvrScheduleModal && !el.dvrScheduleModal.classList.contains('hidden')) ||
      (el.dvrCancelModal && !el.dvrCancelModal.classList.contains('hidden')) ||
      (el.exitModal && !el.exitModal.classList.contains('hidden')) ||
      !el.pinModal.classList.contains('hidden') ||
      (el.favFolderModal && !el.favFolderModal.classList.contains('hidden')) ||
      (el.channelGuideModal && !el.channelGuideModal.classList.contains('hidden')) ||
      (el.splitGuidePanel && !el.splitGuidePanel.classList.contains('hidden')) ||
      !el.channelDrawer.classList.contains('hidden') ||
      !el.epgOverlay.classList.contains('hidden') ||
      !el.settingsModal.classList.contains('hidden')
    );
  }

  function openExitModal() {
    if (!el.exitModal) return;
    el.exitModal.classList.remove('hidden');
    el.exitModal.setAttribute('aria-hidden', 'false');
    if (el.exitCancelBtn) el.exitCancelBtn.focus();
  }

  function closeExitModal() {
    if (!el.exitModal) return;
    el.exitModal.classList.add('hidden');
    el.exitModal.setAttribute('aria-hidden', 'true');
    if (el.btnExitApp) el.btnExitApp.focus();
  }

  function confirmAppExit() {
    closeExitModal();
    if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
      try {
        window.chrome.webview.postMessage({ type: 'app:exit', cmd: 'app:exit' });
      } catch (_) {}
      setTimeout(() => {
        try { window.close(); } catch (_) {}
      }, 200);
      return;
    }
    setTimeout(() => {
      try { window.close(); } catch (_) {}
    }, 200);
  }

  function openChannelGuide() {
    const ch = state.currentChannel;
    if (!ch) {
      showToast('Select a channel first.');
      return;
    }
    if (!el.channelGuideModal) return;
    closeSplitGuide();
    closeDrawer();
    closeEpg();
    closeSettings();
    state.chGuideDayOffset = 0;
    el.channelGuideModal.classList.remove('hidden');
    el.channelGuideModal.setAttribute('aria-hidden', 'false');
    renderChannelGuide();
    if (!Object.keys(state.epgMap || {}).length || (Date.now() - (state.epgLastUpdatedMs || 0)) > 2 * 60 * 60 * 1000) {
      refreshEpgCascade({ sourceLabel: 'Channel Guide' }).catch(() => {});
    }
  }

  function closeChannelGuide() {
    if (!el.channelGuideModal) return;
    el.channelGuideModal.classList.add('hidden');
    el.channelGuideModal.setAttribute('aria-hidden', 'true');
    showOsd();
  }

  function syncSplitGuideViewport() {
    const isOpen = Boolean(
      document.body.classList.contains('split-guide-open') &&
      el.splitGuidePanel &&
      !el.splitGuidePanel.classList.contains('hidden')
    );
    if (isOpen) {
      postMpvCommand('mpv:viewport', { left: 0.5, top: 0, width: 0.5, height: 1 });
    } else {
      postMpvCommand('mpv:viewport', { left: 0, top: 0, width: 1, height: 1 });
    }
  }

  function openSplitGuide() {
    const ch = state.currentChannel || state.channels[0];
    if (!ch) {
      showToast('Load a playlist first.');
      return;
    }
    if (!el.splitGuidePanel) return;
    closeChannelGuide();
    closeDrawer();
    closeEpg();
    closeSettings();
    state.splitGuideDayOffset = 0;
    document.body.classList.add('split-guide-open');
    el.splitGuidePanel.classList.remove('hidden');
    el.splitGuidePanel.setAttribute('aria-hidden', 'false');
    renderSplitGuide();
    syncSplitGuideViewport();
    const target = el.splitGuideList.querySelector('.is-live') || el.splitGuideList.querySelector('.focusable') || el.btnCloseSplitGuide;
    if (target) target.focus();
  }

  function closeSplitGuide() {
    if (!el.splitGuidePanel) return;
    document.body.classList.remove('split-guide-open');
    el.splitGuidePanel.classList.add('hidden');
    el.splitGuidePanel.setAttribute('aria-hidden', 'true');
    syncSplitGuideViewport();
    showOsd();
  }

  function toggleSplitGuide() {
    if (el.splitGuidePanel && !el.splitGuidePanel.classList.contains('hidden')) {
      closeSplitGuide();
    } else {
      openSplitGuide();
    }
  }

  function renderSplitGuide() {
    const ch = state.currentChannel || state.channels[0];
    if (!ch || !el.splitGuidePanel) return;

    if (el.splitGuideChannelBadge) {
      el.splitGuideChannelBadge.textContent = cleanChannelTitle(ch.name) || ch.name || 'Live TV';
    }

    buildSevenDayStrip(el.splitGuideDayBar, state.splitGuideDayOffset, (offset) => {
      state.splitGuideDayOffset = offset;
      renderSplitGuide();
    });

    el.splitGuideList.innerHTML = '';
    const nowMs = Date.now();
    const { startOfDay, endOfDay } = getDayWindowBounds(state.splitGuideDayOffset);
    const programs = getChannelPrograms(ch).filter((p) => p.stop > startOfDay && p.start < endOfDay);

    if (!programs.length) {
      const empty = document.createElement('div');
      empty.className = 'ch-guide-empty';
      empty.textContent = `No programs scheduled for ${formatProgramDayBadge(startOfDay)}.`;
      el.splitGuideList.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    let liveNode = null;
    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      const isLive = p.start <= nowMs && p.stop > nowMs;
      const isPast = p.stop <= nowMs;
      const canCatchup = isPast && hasCatchupSupport(ch);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `split-prog-card focusable${isLive ? ' is-live' : isPast ? ' is-catchup' : ' is-future'}`;
      btn.tabIndex = 0;

      const top = document.createElement('div');
      top.className = 'split-prog-top';

      const metaDiv = document.createElement('div');
      metaDiv.className = 'split-prog-meta';
      metaDiv.innerHTML = `<span class="epg-prog-day-badge">${escapeHtml(formatProgramDayBadge(p.start))}</span><span>${formatTime(p.start)} – ${formatTime(p.stop)}</span>`;

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'split-prog-actions';
      if (p.start > nowMs || (canCatchup && p.stop >= nowMs - 7 * 86400000)) {
        actionsDiv.appendChild(createDvrProgramButton(ch, p));
      }

      const badge = document.createElement('span');
      badge.className = `ch-guide-badge ${isLive ? 'live' : isPast ? 'catchup' : 'future'}`;
      badge.textContent = isLive ? 'LIVE / NOW' : canCatchup ? 'Catch-up' : (isPast ? 'Past' : 'Upcoming');
      actionsDiv.appendChild(badge);

      top.appendChild(metaDiv);
      top.appendChild(actionsDiv);
      btn.appendChild(top);

      const titleDiv = document.createElement('div');
      titleDiv.className = 'split-prog-title';
      titleDiv.setAttribute('dir', 'auto');
      titleDiv.textContent = p.title || 'Untitled Program';
      btn.appendChild(titleDiv);

      btn.addEventListener('click', () => {
        if (isPast) {
          playCatchupProgram(ch, p);
          return;
        }
        playChannel(ch);
      });

      if (isLive && !liveNode) liveNode = btn;
      frag.appendChild(btn);
    }

    el.splitGuideList.appendChild(frag);
    if (liveNode) liveNode.scrollIntoView({ block: 'center' });
  }

  function renderChannelGuide() {
    const ch = state.currentChannel;
    if (!ch || !el.channelGuideModal) return;

    el.chGuideChannelName.textContent = cleanChannelTitle(ch.name) || ch.name || 'Channel TV Guide';
    el.chGuideChannelName.setAttribute('dir', 'auto');
    el.chGuideList.innerHTML = '';

    buildSevenDayStrip(el.chGuideDayBar, state.chGuideDayOffset, (offset) => {
      state.chGuideDayOffset = offset;
      renderChannelGuide();
    });

    const nowMs = Date.now();
    const { startOfDay, endOfDay } = getDayWindowBounds(state.chGuideDayOffset);
    const programs = getChannelPrograms(ch).filter((p) => p.stop > startOfDay && p.start < endOfDay);

    if (!programs.length) {
      el.chGuideRangeBadge.textContent = formatProgramDayBadge(startOfDay);
      const empty = document.createElement('div');
      empty.className = 'ch-guide-empty';
      empty.textContent = `No EPG schedule available for ${formatProgramDayBadge(startOfDay)}.`;
      el.chGuideList.appendChild(empty);
      if (el.chGuideCloseBtn) el.chGuideCloseBtn.focus();
      return;
    }

    const firstDate = new Date(programs[0].start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const lastDate = new Date(programs[programs.length - 1].stop).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    el.chGuideRangeBadge.textContent = `${firstDate} – ${lastDate} (${programs.length})`;

    const frag = document.createDocumentFragment();
    let lastDateKey = '';
    let liveNode = null;

    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      const dateKey = new Date(p.start).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        const header = document.createElement('div');
        header.className = 'ch-guide-date';
        header.textContent = dateKey;
        frag.appendChild(header);
      }

      const isLive = p.start <= nowMs && p.stop > nowMs;
      const isPast = p.stop <= nowMs;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ch-guide-item focusable${isLive ? ' is-live' : isPast ? ' is-catchup' : ' is-future'}`;
      btn.tabIndex = 0;

      const top = document.createElement('div');
      top.className = 'ch-guide-item-top';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'ch-guide-time';
      timeSpan.textContent = `${formatTime(p.start)} – ${formatTime(p.stop)}`;

      const badge = document.createElement('span');
      badge.className = `ch-guide-badge ${isLive ? 'live' : isPast ? 'catchup' : 'future'}`;
      badge.textContent = isLive ? 'LIVE / NOW' : isPast ? 'Catch-up' : 'Upcoming';

      top.appendChild(timeSpan);
      if (p.start > nowMs || (canCatchup && p.stop >= nowMs - 7 * 86400000)) {
        top.appendChild(createDvrProgramButton(ch, p));
      }
      top.appendChild(badge);
      btn.appendChild(top);

      const titleDiv = document.createElement('div');
      titleDiv.className = 'ch-guide-title';
      titleDiv.setAttribute('dir', 'auto');
      titleDiv.textContent = p.title || 'Untitled Program';
      btn.appendChild(titleDiv);

      if (p.desc) {
        const descDiv = document.createElement('div');
        descDiv.className = 'ch-guide-desc';
        descDiv.setAttribute('dir', 'auto');
        descDiv.textContent = p.desc;
        btn.appendChild(descDiv);
      }

      if (isLive) {
        const pct = Math.max(0, Math.min(100, ((nowMs - p.start) / Math.max(1, p.stop - p.start)) * 100));
        const prog = document.createElement('div');
        prog.className = 'ch-guide-progress';
        const bar = document.createElement('span');
        bar.style.width = `${pct.toFixed(1)}%`;
        prog.appendChild(bar);
        btn.appendChild(prog);
        liveNode = btn;
      }

      btn.addEventListener('click', () => {
        if (isLive) {
          closeChannelGuide();
          playChannel(ch);
          return;
        }
        if (isPast) {
          if (playCatchupProgram(ch, p)) {
            closeChannelGuide();
          }
          return;
        }
        showToast('This program has not aired yet.');
      });

      frag.appendChild(btn);
    }

    el.chGuideList.appendChild(frag);
    const focusTarget = liveNode || el.chGuideList.querySelector('.ch-guide-item') || el.chGuideCloseBtn;
    if (focusTarget) {
      focusTarget.focus();
      if (liveNode) liveNode.scrollIntoView({ block: 'center' });
    }
  }

  function openDrawer() {
    closeSplitGuide();
    closeChannelGuide();
    closeEpg();
    closeSettings();
    if (!['live', 'catchup', 'favorites', 'telegram', 'netshare'].includes(state.contentMode)) {
      state.contentMode = 'live';
    }
    renderCategories();
    filterAndRenderChannels();
    const appRoot = document.getElementById('app');
    if (appRoot) appRoot.classList.add('drawer-open');
    el.channelDrawer.classList.remove('hidden');
    el.channelDrawer.setAttribute('aria-hidden', 'false');
    state.isFullscreen = Boolean(window.chrome && window.chrome.webview);
    updateFullscreenButtons();
    syncTacticalCategoryProp(state.contentMode || 'live');
    showOsd();
    const activeItem = el.channelList.querySelector('.playing') || el.channelList.querySelector('.focusable') || el.channelSearchInput;
    if (activeItem) activeItem.focus();
  }

  function closeDrawer() {
    const appRoot = document.getElementById('app');
    if (appRoot) appRoot.classList.remove('drawer-open');
    el.channelDrawer.classList.add('hidden');
    el.channelDrawer.setAttribute('aria-hidden', 'true');
    state.isFullscreen = Boolean(window.chrome && window.chrome.webview);
    updateFullscreenButtons();
    syncTacticalCategoryProp(state.contentMode || 'live');
    showOsd();
  }

  function openEpg() {
    closeSplitGuide();
    closeChannelGuide();
    closeDrawer();
    closeSettings();
    state.epgWindowStart = getFloorHalfHour(Date.now());
    el.epgOverlay.classList.remove('hidden');
    el.epgOverlay.setAttribute('aria-hidden', 'false');
    if (el.epgDateLabel && el.epgDateLabel.parentElement) {
      const headerParent = el.epgDateLabel.parentElement;
      let statusEl = document.getElementById('epgModalStatusText');
      if (!statusEl) {
        statusEl = document.createElement('span');
        statusEl.id = 'epgModalStatusText';
        statusEl.className = 'helper-text';
        statusEl.style.marginLeft = '12px';
        headerParent.appendChild(statusEl);
      }
      const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
      const currentEpgUrl = (el.epgUrlInput && el.epgUrlInput.value.trim()) || meta.epgUrl || (Array.isArray(meta.autoEpgUrls) && meta.autoEpgUrls[0]) || '';
      statusEl.textContent = (state.epgProgramCount > 0)
        ? `TV Guide: ${state.epgProgramCount.toLocaleString()} programs across ${state.epgChannelCount.toLocaleString()} channels`
        : (state.epgLastError || (currentEpgUrl ? 'TV Guide: Loading or 0 programs found' : 'No EPG URL detected — paste XMLTV URL below'));

      let urlInput = document.getElementById('epgModalUrlInput');
      if (!urlInput) {
        urlInput = document.createElement('input');
        urlInput.id = 'epgModalUrlInput';
        urlInput.type = 'url';
        urlInput.placeholder = 'https://.../epg.xml or xml.gz';
        urlInput.style.cssText = 'margin-left:10px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.14);background:#080A0F;color:#f1f5f9;font-size:12px;min-width:220px;';
        headerParent.appendChild(urlInput);
      }
      if (!urlInput.value.trim() && currentEpgUrl) urlInput.value = currentEpgUrl;

      if (!document.getElementById('btnEpgModalLoad')) {
        const loadBtn = document.createElement('button');
        loadBtn.id = 'btnEpgModalLoad';
        loadBtn.type = 'button';
        loadBtn.className = 'btn btn-primary btn-sm focusable';
        loadBtn.textContent = 'Load EPG';
        loadBtn.addEventListener('click', async () => {
          const target = (urlInput.value || '').trim();
          if (!target) {
            showToast('Please paste an XMLTV EPG URL first.');
            return;
          }
          loadBtn.disabled = true;
          loadBtn.textContent = 'Loading...';
          try {
            if (el.epgUrlInput) el.epgUrlInput.value = target;
            await loadEpgFromUrl(target, { silent: false, toastOnUpdate: true, timeoutMs: 25000, sourceLabel: 'TV Guide' });
          } finally {
            loadBtn.disabled = false;
            loadBtn.textContent = 'Load EPG';
          }
        });
        headerParent.appendChild(loadBtn);
      }

      if (!document.getElementById('btnEpgRefreshNow')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'btnEpgRefreshNow';
        refreshBtn.type = 'button';
        refreshBtn.className = 'btn btn-secondary btn-sm focusable';
        refreshBtn.textContent = 'Reload EPG';
        refreshBtn.addEventListener('click', async () => {
          refreshBtn.disabled = true;
          refreshBtn.textContent = 'Reloading...';
          try {
            await loadEpgCascade([], { sourceLabel: 'Manual Refresh' });
          } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Reload EPG';
          }
        });
        headerParent.appendChild(refreshBtn);
      }
    }
    renderEpgGrid();
    if (!Object.keys(state.epgMap || {}).length || (Date.now() - (state.epgLastUpdatedMs || 0)) > 2 * 60 * 60 * 1000) {
      refreshEpgCascade({ sourceLabel: 'TV Guide' }).catch(() => {});
    }
    const firstBlock = el.epgGrid.querySelector('.focusable') || el.btnCloseEpg;
    if (firstBlock) firstBlock.focus();
  }

  function closeEpg() {
    el.epgOverlay.classList.add('hidden');
    el.epgOverlay.setAttribute('aria-hidden', 'true');
    showOsd();
  }

  function isTypingInSetupForm() {
    if (!el.settingsModal || el.settingsModal.classList.contains('hidden')) return false;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && el.settingsModal.contains(active);
  }

  function renderSettingsTab(tabId) {
    if (!tabId) return;
    if (tabId === 'tabM3u' || tabId === 'tabXtream' || tabId === 'tabProfiles' || tabId === 'tabEpg') {
      renderConfiguredSources();
    } else if (tabId === 'tabParental') {
      updatePinStatusUi();
    } else if (tabId === 'tabControls') {
      renderKeyMapper();
    } else if (tabId === 'tabTelegram') {
      refreshTelegramStatus();
    } else if (tabId === 'tabNetShare') {
      loadNetSharesList();
    }
  }

  function openSettings() {
    closeSplitGuide();
    closeChannelGuide();
    closeDrawer();
    closeEpg();
    el.settingsStatus.classList.add('hidden');
    el.settingsModal.classList.remove('hidden');
    el.settingsModal.setAttribute('aria-hidden', 'false');
    syncTacticalCategoryProp('setup');
    const firstTab = el.settingsTabs.querySelector('.tab-btn.active') || el.settingsTabs.querySelector('.focusable');
    const activeTabId = firstTab ? firstTab.dataset.tab : 'tabM3u';
    requestAnimationFrame(() => renderSettingsTab(activeTabId));
    if (firstTab) firstTab.focus();
  }

  function closeSettings() {
    cancelKeyCapture();
    el.settingsModal.classList.add('hidden');
    el.settingsModal.setAttribute('aria-hidden', 'true');
    state.isFullscreen = Boolean(window.chrome && window.chrome.webview);
    updateFullscreenButtons();
    syncTacticalCategoryProp(state.contentMode || 'live');
    showOsd();
  }

  // 10-Foot Spatial Focus Navigation
  function getActiveFocusContainer() {
    const catchupNoticeModal = document.getElementById('dvrCatchupNoticeModal');
    if (catchupNoticeModal && !catchupNoticeModal.classList.contains('hidden')) return catchupNoticeModal;
    if (el.dvrScheduleModal && !el.dvrScheduleModal.classList.contains('hidden')) return el.dvrScheduleModal;
    if (el.dvrCancelModal && !el.dvrCancelModal.classList.contains('hidden')) return el.dvrCancelModal;
    if (el.exitModal && !el.exitModal.classList.contains('hidden')) return el.exitModal;
    if (!el.pinModal.classList.contains('hidden')) return el.pinModal;
    if (el.favFolderModal && !el.favFolderModal.classList.contains('hidden')) return el.favFolderModal;
    if (el.channelGuideModal && !el.channelGuideModal.classList.contains('hidden')) return el.channelGuideModal;
    if (el.splitGuidePanel && !el.splitGuidePanel.classList.contains('hidden')) return el.splitGuidePanel;
    if (!el.settingsModal.classList.contains('hidden')) return el.settingsModal;
    if (!el.epgOverlay.classList.contains('hidden')) return el.epgOverlay;
    if (!el.channelDrawer.classList.contains('hidden')) return el.channelDrawer;
    if (!el.emptyOverlay.classList.contains('hidden')) return el.emptyOverlay;
    return el.playerStage;
  }

  function moveFocusDirection(direction) {
    const container = getActiveFocusContainer();
    const candidates = Array.from(container.querySelectorAll('.focusable')).filter((node) => {
      if (node.disabled) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!candidates.length) return;

    const current = document.activeElement;
    if (!current || !container.contains(current) || !current.classList.contains('focusable')) {
      candidates[0].focus();
      candidates[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }

    const curRect = current.getBoundingClientRect();
    const curX = curRect.left + curRect.width / 2;
    const curY = curRect.top + curRect.height / 2;

    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (cand === current) continue;
      const r = cand.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = cx - curX;
      const dy = cy - curY;

      let valid = false;
      let primary = 0;
      let secondary = 0;

      if (direction === 'ArrowUp' && dy < -6) {
        valid = true;
        primary = -dy;
        secondary = Math.abs(dx);
      } else if (direction === 'ArrowDown' && dy > 6) {
        valid = true;
        primary = dy;
        secondary = Math.abs(dx);
      } else if (direction === 'ArrowLeft' && dx < -6) {
        valid = true;
        primary = -dx;
        secondary = Math.abs(dy);
      } else if (direction === 'ArrowRight' && dx > 6) {
        valid = true;
        primary = dx;
        secondary = Math.abs(dy);
      }

      if (!valid) continue;
      const score = primary + secondary * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function handleNumericEntry(digit) {
    state.numBuffer = (state.numBuffer + digit).slice(-4);
    el.channelNumberEntry.textContent = state.numBuffer;
    el.channelNumberEntry.classList.remove('hidden');
    clearTimeout(state.numTimer);
    state.numTimer = setTimeout(() => {
      const targetNum = parseInt(state.numBuffer, 10);
      state.numBuffer = '';
      el.channelNumberEntry.classList.add('hidden');
      const ch = state.channels.find((c) => c.number === targetNum);
      if (ch) {
        playChannel(ch);
      } else {
        showToast(`Channel ${targetNum} not found`);
      }
    }, 1300);
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  // Single Source-of-Truth Input & Remote Action Registry
  function cycleOsdSelectOption(selectEl, labelPrefix) {
    if (!selectEl || !selectEl.options || selectEl.options.length <= 1) {
      showToast(`No ${labelPrefix} tracks available`);
      return;
    }
    const nextIdx = (selectEl.selectedIndex + 1) % selectEl.options.length;
    selectEl.selectedIndex = nextIdx;
    selectEl.dispatchEvent(new Event('change'));
    showToast(`${labelPrefix}: ${selectEl.options[nextIdx].textContent}`);
  }

  async function reseekCatchupFromOffset(targetSec) {
    const ctx = state.catchupRetryContext || {
      channel: state.currentChannel,
      program: state.currentCatchupProgram
    };
    const baseProgram = ctx && ctx.program;
    const baseChannel = ctx && ctx.channel;
    if (!baseChannel || !baseProgram || !baseProgram.start || !(baseProgram.stop || baseProgram.end)) {
      showToast('Seek unavailable for this Catch-up stream');
      return false;
    }
    const endMs = baseProgram.stop || baseProgram.end;
    const clampedSec = Math.max(0, Math.floor(Number(targetSec) || 0));
    const shiftedStartMs = baseProgram.start + (clampedSec * 1000);
    if (shiftedStartMs >= endMs) return false;
    showToast(`Seeking Catch-up to ${formatDurationClock(clampedSec)}...`, 1800);
    const resolved = await resolveCatchupStream(baseChannel, { ...baseProgram, start: shiftedStartMs });
    if (!resolved || !resolved.ok) {
      showToast('Seek unavailable for this Catch-up stream');
      return false;
    }
    state.catchupRetryQueue = resolved.candidates.filter((u) => u !== resolved.url);
    state.lastCatchupUrl = resolved.url;
    playChannel(
      { ...baseChannel, url: resolved.url },
      {
        overrideUrl: resolved.url,
        isCatchup: true,
        programTitle: baseProgram.title,
        programStart: baseProgram.start,
        programStop: endMs,
        catchupOffsetSec: clampedSec
      }
    );
    return true;
  }

  function seekToMediaSeconds(targetSec, { relativeDelta = null } = {}) {
    const total = getMediaDurationSeconds();
    const clamped = total > 0 ? Math.max(0, Math.min(total, targetSec)) : Math.max(0, targetSec);
    if (state.pendingCatchupSeek && state.pendingCatchupSeek.timer) {
      clearTimeout(state.pendingCatchupSeek.timer);
      state.pendingCatchupSeek = null;
    }
    if (state.mpvActive) {
      if (state.currentCatchupProgram) {
        const offsetBase = Number(state.catchupSeekOffsetSec) || 0;
        const streamTarget = clamped - offsetBase;
        if (streamTarget < 0) {
          reseekCatchupFromOffset(clamped);
          return;
        }
        if (relativeDelta !== null) {
          postMpvCommand('mpv:seek', { seconds: relativeDelta, absolute: false });
        } else {
          postMpvCommand('mpv:seek', { seconds: streamTarget, absolute: true });
        }
        const prevRawPos = Number.isFinite(state.mpvPosition) ? state.mpvPosition : 0;
        const timer = setTimeout(() => {
          const pending = state.pendingCatchupSeek;
          if (!pending) return;
          state.pendingCatchupSeek = null;
          const curRaw = Number.isFinite(state.mpvPosition) ? state.mpvPosition : 0;
          if (Math.abs(curRaw - pending.streamTarget) > 15 && Math.abs(curRaw - pending.prevRawPos) < 3) {
            reseekCatchupFromOffset(pending.targetSec);
          }
        }, 1400);
        state.pendingCatchupSeek = { targetSec: clamped, streamTarget, prevRawPos, timer };
        updateSeekUi();
        showOsd();
        return;
      }
      if (relativeDelta !== null) {
        postMpvCommand('mpv:seek', { seconds: relativeDelta, absolute: false });
      } else {
        state.mpvPosition = clamped;
        postMpvCommand('mpv:seek', { seconds: clamped, absolute: true });
      }
      updateSeekUi();
      showOsd();
      return;
    }
    if (el.video && Number.isFinite(el.video.duration) && el.video.duration > 0) {
      el.video.currentTime = Math.max(0, Math.min(el.video.duration, clamped));
      updateSeekUi();
      showOsd();
    }
  }

  function seekRelativeSeconds(deltaSec) {
    if (state.mpvActive) {
      const cur = getMediaPositionSeconds();
      seekToMediaSeconds(cur + deltaSec, { relativeDelta: deltaSec });
      showToast(deltaSec >= 0 ? `Forward ${deltaSec}s` : `Back ${Math.abs(deltaSec)}s`);
      return;
    }
    if (el.video && Number.isFinite(el.video.duration) && el.video.duration > 0) {
      el.video.currentTime = Math.max(0, Math.min(el.video.duration, el.video.currentTime + deltaSec));
      updateSeekUi();
      showOsd();
      showToast(deltaSec >= 0 ? `Forward ${deltaSec}s` : `Back ${Math.abs(deltaSec)}s`);
    }
  }

  function handleDirectionalNav(direction) {
    if (!isAnyOverlayOpen() && el.playerStage.classList.contains('osd-hidden') && el.emptyOverlay.classList.contains('hidden')) {
      if (direction === 'ArrowUp') zapChannel(1);
      else if (direction === 'ArrowDown') zapChannel(-1);
      else showOsd();
      return true;
    }
    showOsd();
    moveFocusDirection(direction);
    return true;
  }

  function handleSelectNav() {
    if (el.exitModal && !el.exitModal.classList.contains('hidden')) {
      if (document.activeElement === el.exitCancelBtn) closeExitModal();
      else confirmAppExit();
      return true;
    }
    if (!isAnyOverlayOpen()) {
      const active = document.activeElement;
      if (!active || active === document.body || el.playerStage.classList.contains('osd-hidden')) {
        openDrawer();
        return true;
      }
    }
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.click === 'function') {
      active.click();
      return true;
    }
    return false;
  }

  const CONTROL_ACTIONS = [
    {
      id: 'navUp',
      label: 'Navigate Up',
      defaultBinding: { token: 'ArrowUp', code: 'ArrowUp', key: 'ArrowUp', label: 'ArrowUp' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>',
      handler: () => handleDirectionalNav('ArrowUp')
    },
    {
      id: 'navDown',
      label: 'Navigate Down',
      defaultBinding: { token: 'ArrowDown', code: 'ArrowDown', key: 'ArrowDown', label: 'ArrowDown' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>',
      handler: () => handleDirectionalNav('ArrowDown')
    },
    {
      id: 'navLeft',
      label: 'Navigate Left',
      defaultBinding: { token: 'ArrowLeft', code: 'ArrowLeft', key: 'ArrowLeft', label: 'ArrowLeft' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>',
      handler: () => handleDirectionalNav('ArrowLeft')
    },
    {
      id: 'navRight',
      label: 'Navigate Right',
      defaultBinding: { token: 'ArrowRight', code: 'ArrowRight', key: 'ArrowRight', label: 'ArrowRight' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>',
      handler: () => handleDirectionalNav('ArrowRight')
    },
    {
      id: 'navSelect',
      label: 'Select / OK',
      defaultBinding: { token: 'Enter', code: 'Enter', key: 'Enter', label: 'Enter' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      handler: () => handleSelectNav()
    },
    {
      id: 'playPause',
      label: 'Play / Pause',
      defaultBinding: { token: 'Space', code: 'Space', key: ' ', label: 'Space' },
      icon: '<svg viewBox="0 0 24 24"><polygon points="6 4 14 12 6 20 6 4"></polygon><line x1="17" y1="5" x2="17" y2="19"></line><line x1="20" y1="5" x2="20" y2="19"></line></svg>',
      handler: () => { togglePlayPause(); return true; }
    },
    {
      id: 'stop',
      label: 'Stop Playback',
      defaultBinding: { token: 'KeyX', code: 'KeyX', key: 'x', label: 'X' },
      icon: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg>',
      handler: () => { stopPlayback(); return true; }
    },
    {
      id: 'channelUp',
      label: 'Channel Up',
      defaultBinding: { token: 'PageUp', code: 'PageUp', key: 'PageUp', label: 'PageUp' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>',
      handler: () => { zapChannel(1); return true; }
    },
    {
      id: 'channelDown',
      label: 'Channel Down',
      defaultBinding: { token: 'PageDown', code: 'PageDown', key: 'PageDown', label: 'PageDown' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>',
      handler: () => { zapChannel(-1); return true; }
    },
    {
      id: 'openChannels',
      label: 'Open Browse / Channels',
      defaultBinding: { token: 'KeyL', code: 'KeyL', key: 'l', label: 'L' },
      icon: '<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
      handler: () => { if (el.channelDrawer.classList.contains('hidden')) openDrawer(); else closeDrawer(); return true; }
    },
    {
      id: 'openEpg',
      label: 'Open TV Guide',
      defaultBinding: { token: 'KeyG', code: 'KeyG', key: 'g', label: 'G' },
      icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="9" y1="4" x2="9" y2="20"></line></svg>',
      handler: () => { if (el.epgOverlay.classList.contains('hidden')) openEpg(); else closeEpg(); return true; }
    },
    {
      id: 'toggleSplitGuide',
      label: 'Toggle Split-Screen Guide',
      defaultBinding: { token: 'KeyT', code: 'KeyT', key: 't', label: 'T' },
      icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="11" y1="4" x2="11" y2="20"></line><line x1="5.5" y1="8" x2="8.5" y2="8"></line><line x1="5.5" y1="12" x2="8.5" y2="12"></line></svg>',
      handler: () => { toggleSplitGuide(); return true; }
    },
    {
      id: 'record',
      label: 'Record / Schedule DVR',
      defaultBinding: { token: 'KeyR', code: 'KeyR', key: 'r', label: 'R' },
      icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
      handler: () => { toggleDvrRecording(); return true; }
    },
    {
      id: 'stats',
      label: 'Toggle Stats',
      defaultBinding: { token: 'KeyD', code: 'KeyD', key: 'd', label: 'D' },
      icon: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
      handler: () => { toggleDiagnostics(); return true; }
    },
    {
      id: 'aspectRatio',
      label: 'Aspect Ratio',
      defaultBinding: { token: 'KeyA', code: 'KeyA', key: 'a', label: 'A' },
      icon: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 15v-4h4"></path><path d="M17 9v4h-4"></path></svg>',
      handler: () => { cycleAspectRatio(); return true; }
    },
    {
      id: 'toggleFavorite',
      label: 'Toggle Favorite',
      defaultBinding: { token: 'KeyF', code: 'KeyF', key: 'f', label: 'F' },
      icon: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
      handler: () => { toggleFavorite(); return true; }
    },
    {
      id: 'toggleOsd',
      label: 'Toggle OSD Info',
      defaultBinding: { token: 'KeyI', code: 'KeyI', key: 'i', label: 'I' },
      icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      handler: () => { toggleOsd(); return true; }
    },
    {
      id: 'mute',
      label: 'Mute / Unmute',
      defaultBinding: { token: 'KeyM', code: 'KeyM', key: 'm', label: 'M' },
      icon: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>',
      handler: () => {
        if (state.mpvActive) {
          state.mpvMuted = !state.mpvMuted;
          postMpvCommand('mpv:mute', { muted: state.mpvMuted });
        } else {
          el.video.muted = !el.video.muted;
        }
        updateOsd();
        showOsd();
        return true;
      }
    },
    {
      id: 'volumeUp',
      label: 'Volume Up',
      defaultBinding: { token: 'Equal', code: 'Equal', key: '=', label: '+' },
      icon: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
      handler: () => { adjustVolume(0.05); return true; }
    },
    {
      id: 'volumeDown',
      label: 'Volume Down',
      defaultBinding: { token: 'Minus', code: 'Minus', key: '-', label: '-' },
      icon: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
      handler: () => { adjustVolume(-0.05); return true; }
    },
    {
      id: 'seekBack',
      label: 'Seek Backward (-15s)',
      defaultBinding: { token: 'BracketLeft', code: 'BracketLeft', key: '[', label: '[' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>',
      handler: () => { seekRelativeSeconds(-15); return true; }
    },
    {
      id: 'seekForward',
      label: 'Seek Forward (+15s)',
      defaultBinding: { token: 'BracketRight', code: 'BracketRight', key: ']', label: ']' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>',
      handler: () => { seekRelativeSeconds(15); return true; }
    },
    {
      id: 'cycleAudio',
      label: 'Cycle Audio Track',
      defaultBinding: { token: 'KeyB', code: 'KeyB', key: 'b', label: 'B' },
      icon: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
      handler: () => { cycleOsdSelectOption(el.osdAudioSelect, 'Audio'); return true; }
    },
    {
      id: 'cycleSubtitles',
      label: 'Cycle Subtitles',
      defaultBinding: { token: 'KeyC', code: 'KeyC', key: 'c', label: 'C' },
      icon: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><line x1="7" y1="15" x2="13" y2="15"></line><line x1="15" y1="15" x2="17" y2="15"></line></svg>',
      handler: () => { cycleOsdSelectOption(el.osdSubSelect, 'Subtitles'); return true; }
    },
    {
      id: 'toggleFullscreen',
      label: 'Toggle Fullscreen',
      defaultBinding: { token: 'F11', code: 'F11', key: 'F11', label: 'F11' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>',
      handler: () => { toggleFullscreenMode(); return true; }
    },
    {
      id: 'openSetup',
      label: 'Open Setup',
      defaultBinding: { token: 'KeyS', code: 'KeyS', key: 's', label: 'S' },
      icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
      handler: () => { if (el.settingsModal.classList.contains('hidden')) openSettings(); else closeSettings(); return true; }
    },
    {
      id: 'backClose',
      label: 'Back / Close',
      defaultBinding: { token: 'Escape', code: 'Escape', key: 'Escape', label: 'Escape' },
      icon: '<svg viewBox="0 0 24 24"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>',
      handler: () => handleBackOrClose()
    }
  ];
  const PLAYER_ACTIONS = CONTROL_ACTIONS;

  function registerControlAction(actionDef) {
    if (!actionDef || !actionDef.id || !actionDef.label || typeof actionDef.handler !== 'function') return;
    const normalized = {
      id: String(actionDef.id),
      label: String(actionDef.label),
      defaultBinding: actionDef.defaultBinding || { token: '', code: '', key: '', label: 'Unbound' },
      icon: actionDef.icon || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"></circle></svg>',
      handler: actionDef.handler
    };
    const existingIdx = CONTROL_ACTIONS.findIndex((a) => a.id === normalized.id);
    if (existingIdx >= 0) {
      CONTROL_ACTIONS[existingIdx] = normalized;
    } else {
      CONTROL_ACTIONS.push(normalized);
    }
    if (state.keyMap && !state.keyMap[normalized.id]) {
      state.keyMap[normalized.id] = { ...normalized.defaultBinding };
    }
    if (el.settingsModal && !el.settingsModal.classList.contains('hidden')) {
      renderKeyMapper();
    }
  }

  function buildDefaultKeyMap() {
    const map = {};
    for (let i = 0; i < PLAYER_ACTIONS.length; i++) {
      const a = PLAYER_ACTIONS[i];
      map[a.id] = { ...a.defaultBinding };
    }
    return map;
  }

  function loadKeyMap() {
    const defaults = buildDefaultKeyMap();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.KEY_MAP);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (let i = 0; i < PLAYER_ACTIONS.length; i++) {
          const id = PLAYER_ACTIONS[i].id;
          if (parsed && parsed[id] && typeof parsed[id].label === 'string') {
            if (id === 'openChannels' && parsed[id].token === 'Enter' && !parsed.navSelect) {
              continue;
            }
            defaults[id] = {
              token: parsed[id].token || '',
              code: parsed[id].code || '',
              key: parsed[id].key || '',
              label: parsed[id].label
            };
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load key map:', err);
    }
    state.keyMap = defaults;
  }

  function saveKeyMap() {
    localStorage.setItem(STORAGE_KEYS.KEY_MAP, JSON.stringify(state.keyMap));
  }

  function resetKeyMap() {
    cancelKeyCapture();
    state.keyMap = buildDefaultKeyMap();
    saveKeyMap();
    renderKeyMapper();
    setSettingsStatus('Controls reset to default key bindings.', 'success');
    showToast('Controls reset to defaults');
  }

  function formatKeyLabel(e) {
    if (e.code === 'Space' || e.key === ' ') return 'Space';
    if (e.code && e.code.startsWith('Key') && e.code.length === 4) return e.code.slice(3);
    if (e.code && e.code.startsWith('Digit') && e.code.length === 6) return e.code.slice(5);
    if (e.key && e.key.length === 1) return e.key.toUpperCase();
    return e.code || e.key || 'Unknown';
  }

  function getActionById(actionId) {
    return PLAYER_ACTIONS.find((a) => a.id === actionId) || null;
  }

  function renderKeyMapper() {
    if (!el.keyMapperList) return;
    el.keyMapperList.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (let i = 0; i < PLAYER_ACTIONS.length; i++) {
      const action = PLAYER_ACTIONS[i];
      const binding = state.keyMap[action.id] || action.defaultBinding;
      const isCapturing = state.capturingActionId === action.id;
      const isUnbound = !binding || !binding.token;

      const row = document.createElement('div');
      row.className = 'key-mapper-row' + (isCapturing ? ' is-capturing' : '');
      row.innerHTML = `
        <div class="key-action-info">
          <span class="key-action-icon" aria-hidden="true">${action.icon}</span>
          <span class="key-action-label">${escapeHtml(action.label)}</span>
        </div>
        <div class="key-action-controls">
          <span class="key-binding-badge${isUnbound ? ' is-unbound' : ''}">${escapeHtml(isCapturing ? 'Listening...' : (binding.label || 'Unbound'))}</span>
          <button class="btn btn-secondary btn-sm focusable key-bind-btn" data-action-id="${action.id}" tabindex="0">${isCapturing ? 'Listening' : 'Bind'}</button>
        </div>
      `;
      const bindBtn = row.querySelector('.key-bind-btn');
      bindBtn.addEventListener('click', () => startKeyCapture(action.id));
      frag.appendChild(row);
    }

    el.keyMapperList.appendChild(frag);
  }

  function startKeyCapture(actionId) {
    const action = getActionById(actionId);
    if (!action) return;
    state.capturingActionId = actionId;
    if (el.keyCaptureText) {
      el.keyCaptureText.textContent = `Press any key or remote button for "${action.label}"...`;
    }
    if (el.keyCaptureBanner) {
      el.keyCaptureBanner.classList.remove('hidden');
    }
    renderKeyMapper();
  }

  function cancelKeyCapture() {
    if (!state.capturingActionId) return;
    const prevId = state.capturingActionId;
    state.capturingActionId = null;
    if (el.keyCaptureBanner) {
      el.keyCaptureBanner.classList.add('hidden');
    }
    renderKeyMapper();
    const btn = el.keyMapperList && el.keyMapperList.querySelector(`.key-bind-btn[data-action-id="${prevId}"]`);
    if (btn) btn.focus();
  }

  function assignCapturedBinding(actionId, newBinding) {
    if (!actionId || !newBinding || !newBinding.token) return;
    const targetAction = getActionById(actionId);
    if (!targetAction) return;

    let replacedFrom = null;
    for (let i = 0; i < PLAYER_ACTIONS.length; i++) {
      const other = PLAYER_ACTIONS[i];
      if (other.id === actionId) continue;
      const existing = state.keyMap[other.id];
      if (existing && existing.token === newBinding.token) {
        replacedFrom = other.label;
        state.keyMap[other.id] = { token: '', code: '', key: '', label: 'Unbound' };
      }
    }

    state.keyMap[actionId] = newBinding;
    saveKeyMap();
    state.capturingActionId = null;
    if (el.keyCaptureBanner) {
      el.keyCaptureBanner.classList.add('hidden');
    }
    renderKeyMapper();

    if (replacedFrom) {
      const msg = `Bound "${newBinding.label}" to ${targetAction.label} (unassigned from ${replacedFrom}).`;
      setSettingsStatus(msg, 'info');
      showToast(msg);
    } else {
      const msg = `Bound "${newBinding.label}" to ${targetAction.label}.`;
      setSettingsStatus(msg, 'success');
      showToast(msg);
    }

    const btn = el.keyMapperList && el.keyMapperList.querySelector(`.key-bind-btn[data-action-id="${actionId}"]`);
    if (btn) btn.focus();
  }

  function findBoundActionForKeyEvent(e) {
    const code = e.code || '';
    const keyLower = (e.key || '').toLowerCase();
    for (let i = 0; i < PLAYER_ACTIONS.length; i++) {
      const id = PLAYER_ACTIONS[i].id;
      const b = state.keyMap[id];
      if (!b || !b.token) continue;
      if (b.code && code && b.code === code) return id;
      if (b.key && keyLower && b.key.toLowerCase() === keyLower && !b.token.startsWith('Gamepad:')) return id;
      if (b.token === code || b.token.toLowerCase() === keyLower) return id;
    }
    return null;
  }

  function findBoundActionForToken(token) {
    for (let i = 0; i < PLAYER_ACTIONS.length; i++) {
      const id = PLAYER_ACTIONS[i].id;
      const b = state.keyMap[id];
      if (b && b.token === token) return id;
    }
    return null;
  }

  function updateFullscreenButtons() {
    const label = state.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
    [el.btnFullscreen, document.getElementById('osdFullscreenBtn')].forEach((btn) => {
      if (!btn) return;
      const span = btn.querySelector('span');
      if (span) span.textContent = label;
      btn.classList.toggle('is-active', Boolean(state.isFullscreen));
    });
  }

  function toggleFullscreenMode(forceState = null) {
    const nextState = typeof forceState === 'boolean' ? forceState : !state.isFullscreen;
    state.isFullscreen = nextState;
    if (window.chrome && window.chrome.webview) {
      try {
        window.chrome.webview.postMessage({ type: 'app:fullscreen', cmd: 'app:fullscreen', fullscreen: nextState });
      } catch (_) {}
    }
    if (nextState && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!nextState && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    updateFullscreenButtons();
  }

  function adjustVolume(delta) {
    const next = Math.max(0, Math.min(1, Number((el.video.volume + delta).toFixed(2))));
    el.video.volume = next;
    if (state.mpvActive) {
      postMpvCommand('mpv:volume', { volume: Math.round(next * 100) });
      if (next > 0 && state.mpvMuted) {
        state.mpvMuted = false;
        postMpvCommand('mpv:mute', { muted: false });
      }
    } else if (next > 0 && el.video.muted) {
      el.video.muted = false;
    }
    updateOsd();
    showOsd();
    showToast(`Volume: ${Math.round(next * 100)}%`);
  }

  function handleBackOrClose() {
    const catchupNoticeModal = document.getElementById('dvrCatchupNoticeModal');
    if (catchupNoticeModal && !catchupNoticeModal.classList.contains('hidden')) {
      closeDvrCatchupNoticeModal();
      return true;
    }
    if (el.dvrScheduleModal && !el.dvrScheduleModal.classList.contains('hidden')) {
      closeDvrScheduleModal();
      return true;
    }
    if (el.dvrCancelModal && !el.dvrCancelModal.classList.contains('hidden')) {
      closeDvrCancelModal();
      return true;
    }
    if (el.exitModal && !el.exitModal.classList.contains('hidden')) {
      closeExitModal();
      return true;
    }
    if (el.exitModal && !el.exitModal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeExitModal();
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        moveFocusDirection(e.key);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (document.activeElement === el.exitCancelBtn) {
          closeExitModal();
        } else {
          confirmAppExit();
        }
        return;
      }
      return;
    }

    if (!el.pinModal.classList.contains('hidden')) {
      closePinModal();
      return true;
    }
    if (el.favFolderModal && !el.favFolderModal.classList.contains('hidden')) {
      closeFavFolderModal();
      return true;
    }
    if (el.channelGuideModal && !el.channelGuideModal.classList.contains('hidden')) {
      closeChannelGuide();
      return true;
    }
    if (el.splitGuidePanel && !el.splitGuidePanel.classList.contains('hidden')) {
      closeSplitGuide();
      return true;
    }
    if (!el.settingsModal.classList.contains('hidden')) {
      closeSettings();
      return true;
    }
    if (!el.epgOverlay.classList.contains('hidden')) {
      closeEpg();
      return true;
    }
    if (!el.channelDrawer.classList.contains('hidden')) {
      closeDrawer();
      return true;
    }
    if (!el.playerStage.classList.contains('osd-hidden')) {
      toggleOsd();
      return true;
    }
    return false;
  }

  function executePlayerAction(actionId) {
    const action = getActionById(actionId);
    if (!action || typeof action.handler !== 'function') return false;
    return Boolean(action.handler());
  }

  function pollGamepads() {
    if (!navigator.getGamepads || isTypingInSetupForm()) return;
    const pads = navigator.getGamepads();
    if (!pads) return;

    for (let p = 0; p < pads.length; p++) {
      const pad = pads[p];
      if (!pad || !pad.buttons) continue;
      const prev = state.gamepadPrevButtons.get(pad.index) || [];
      const curr = [];

      for (let b = 0; b < pad.buttons.length; b++) {
        const pressed = Boolean(pad.buttons[b] && pad.buttons[b].pressed);
        curr[b] = pressed;
        if (pressed && !prev[b]) {
          const token = `Gamepad:B${b}`;
          if (state.capturingActionId) {
            assignCapturedBinding(state.capturingActionId, {
              token,
              code: token,
              key: token,
              label: `Gamepad Btn ${b}`
            });
          } else {
            const boundAction = findBoundActionForToken(token);
            if (boundAction) {
              executePlayerAction(boundAction);
            } else if (isAnyOverlayOpen()) {
              if (b === 12) moveFocusDirection('ArrowUp');
              else if (b === 13) moveFocusDirection('ArrowDown');
              else if (b === 14) moveFocusDirection('ArrowLeft');
              else if (b === 15) moveFocusDirection('ArrowRight');
              else if (b === 0 && document.activeElement) document.activeElement.click();
              else if (b === 1) handleBackOrClose();
            }
          }
        }
      }
      state.gamepadPrevButtons.set(pad.index, curr);
    }
  }

  // Global Keyboard / Remote Handler
  function handleKeyDown(e) {
    if (state.capturingActionId) {
      e.preventDefault();
      e.stopPropagation();
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }
      const token = e.code || e.key;
      if (!token) return;
      assignCapturedBinding(state.capturingActionId, {
        token,
        code: e.code || '',
        key: e.key || '',
        label: formatKeyLabel(e)
      });
      return;
    }

    const typing = isTypingTarget(e.target);

    if (e.key === 'Tab' && isAnyOverlayOpen()) {
      const container = getActiveFocusContainer();
      const focusables = Array.from(container.querySelectorAll('.focusable')).filter((node) => {
        if (node.disabled) return false;
        const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (focusables.length > 0) {
        e.preventDefault();
        const curIdx = focusables.indexOf(document.activeElement);
        const nextIdx = e.shiftKey
          ? (curIdx <= 0 ? focusables.length - 1 : curIdx - 1)
          : (curIdx < 0 || curIdx >= focusables.length - 1 ? 0 : curIdx + 1);
        focusables[nextIdx].focus();
        focusables[nextIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      return;
    }

    if (el.exitModal && !el.exitModal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeExitModal();
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        moveFocusDirection(e.key);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (document.activeElement === el.exitCancelBtn) {
          closeExitModal();
        } else {
          confirmAppExit();
        }
        return;
      }
      return;
    }

    if (!el.pinModal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePinModal();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        state.pinBuffer = state.pinBuffer.slice(0, -1);
        updatePinDots();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handlePinDigit(e.key);
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        moveFocusDirection(e.key);
        return;
      }
      return;
    }

    if (e.key === 'Escape' || (e.key === 'Backspace' && !typing)) {
      if (handleBackOrClose()) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape' && !typing && state.isFullscreen) {
        e.preventDefault();
        toggleFullscreenMode(false);
        return;
      }
    }

    if (typing) {
      // Allow Up/Down arrows to exit search input into channel list
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target === el.channelSearchInput) {
        e.preventDefault();
        moveFocusDirection(e.key);
      }
      return;
    }

    // Numeric direct channel entry
    if (/^[0-9]$/.test(e.key) && !isAnyOverlayOpen()) {
      e.preventDefault();
      handleNumericEntry(e.key);
      return;
    }

    // Route through user-customizable key map (including navUp/navDown/navLeft/navRight/navSelect)
    const boundAction = findBoundActionForKeyEvent(e);
    if (boundAction) {
      if (boundAction === 'navSelect' && e.key === 'Enter' && isAnyOverlayOpen() && document.activeElement && document.activeElement !== document.body) {
        // Let native button/link Enter activation proceed cleanly when already focused inside an overlay
        return;
      }
      e.preventDefault();
      executePlayerAction(boundAction);
      return;
    }

    // Fallback directional D-Pad navigation when arrow keys are unbound
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      handleDirectionalNav(e.key);
      return;
    }

    // Built-in TV remote media key fallbacks & search shortcut
    switch (e.key) {
      case 'ChannelUp':
      case 'MediaTrackNext':
        e.preventDefault();
        zapChannel(1);
        break;
      case 'ChannelDown':
      case 'MediaTrackPrevious':
        e.preventDefault();
        zapChannel(-1);
        break;
      case 'MediaPlayPause':
        e.preventDefault();
        executePlayerAction('playPause');
        break;
      case 'MediaStop':
        e.preventDefault();
        teardownActiveStream();
        showOsd();
        break;
      case 'AudioVolumeUp':
        e.preventDefault();
        executePlayerAction('volumeUp');
        break;
      case 'AudioVolumeDown':
        e.preventDefault();
        executePlayerAction('volumeDown');
        break;
      case 'AudioVolumeMute':
        e.preventDefault();
        executePlayerAction('mute');
        break;
      case 'Info':
      case 'ContextMenu':
        e.preventDefault();
        toggleOsd();
        break;
      case '/':
        e.preventDefault();
        openDrawer();
        el.channelSearchInput.focus();
        break;
    }
  }

  // Multi-Profile & JSON Backup/Restore
  function saveProfilesStorage() {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(state.profiles));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, state.activeProfileId || '');
  }

  function renderProfiles() {
    if (!el.profileList) return;
    el.profileList.innerHTML = '';
    if (!state.profiles.length) {
      el.profileList.innerHTML = '<p class="helper-text">No saved profiles yet. Load an M3U or Xtream source and save it here.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    state.profiles.forEach((prof) => {
      const isActive = prof.id === state.activeProfileId;
      const row = document.createElement('div');
      row.className = 'profile-item' + (isActive ? ' active-profile' : '');

      const meta = document.createElement('div');
      meta.className = 'profile-meta';
      const typeLabel = prof.type === 'xtream' ? 'Xtream Codes' : 'M3U URL';
      const epgNote = prof.epgOverride ? ' • Custom EPG' : '';
      meta.innerHTML = `
        <div class="profile-name">${escapeHtml(prof.name)}</div>
        <div class="profile-sub">${typeLabel}${epgNote}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'profile-actions';

      const useBtn = document.createElement('button');
      useBtn.className = 'btn btn-primary btn-sm focusable';
      useBtn.tabIndex = 0;
      useBtn.textContent = isActive ? 'Active' : 'Connect';
      useBtn.addEventListener('click', () => activateProfile(prof));

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger btn-sm focusable';
      delBtn.tabIndex = 0;
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        state.profiles = state.profiles.filter((p) => p.id !== prof.id);
        if (state.activeProfileId === prof.id) state.activeProfileId = '';
        saveProfilesStorage();
        renderProfiles();
        setSettingsStatus(`Deleted profile "${prof.name}".`, 'info');
      });

      actions.appendChild(useBtn);
      actions.appendChild(delBtn);
      row.appendChild(meta);
      row.appendChild(actions);
      frag.appendChild(row);
    });
    el.profileList.appendChild(frag);
  }

  function saveCurrentProfile() {
    const name = (el.profileNameInput.value || '').trim();
    if (!name) {
      setSettingsStatus('Please enter a profile name.', 'error');
      return;
    }
    const epgOverride = (el.profileEpgOverrideInput.value || '').trim();
    const xUrl = (el.xtreamUrlInput.value || '').trim();
    const xUser = (el.xtreamUserInput.value || '').trim();
    const xPass = (el.xtreamPassInput.value || '').trim();
    const m3uUrl = (el.m3uUrlInput.value || '').trim();

    let profile = null;
    if (xUrl && xUser && xPass) {
      profile = {
        id: 'prof_' + Date.now(),
        name,
        type: 'xtream',
        url: xUrl,
        user: xUser,
        pass: xPass,
        format: el.xtreamFormatSelect.value || 'm3u8',
        epgOverride
      };
    } else if (m3uUrl) {
      profile = {
        id: 'prof_' + Date.now(),
        name,
        type: 'm3u',
        m3uUrl,
        epgOverride
      };
    } else {
      setSettingsStatus('Configure an M3U URL or Xtream Codes credentials first.', 'error');
      return;
    }

    state.profiles.push(profile);
    state.activeProfileId = profile.id;
    saveProfilesStorage();
    el.profileNameInput.value = '';
    el.profileEpgOverrideInput.value = '';
    renderProfiles();
    setSettingsStatus(`Saved profile "${name}".`, 'success');
  }

  async function activateProfile(prof) {
    if (!prof) return;
    // Strict Single-Stream Guard: tear down any active stream before switching profiles
    teardownActiveStream();
    state.activeProfileId = prof.id;
    saveProfilesStorage();
    renderProfiles();

    if (prof.type === 'xtream') {
      el.xtreamUrlInput.value = prof.url || '';
      el.xtreamUserInput.value = prof.user || '';
      el.xtreamPassInput.value = prof.pass || '';
      el.xtreamFormatSelect.value = prof.format || 'm3u8';
      await loadXtreamCodes();
    } else if (prof.type === 'm3u' && prof.m3uUrl) {
      el.m3uUrlInput.value = prof.m3uUrl;
      await loadM3uFromUrl(prof.m3uUrl);
    }

    if (prof.epgOverride) {
      el.epgUrlInput.value = prof.epgOverride;
      await loadEpgFromUrl(prof.epgOverride);
    }
  }

  function exportBackupJson() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      favorites: state.favoriteStore,
      recents: state.recents,
      profiles: state.profiles,
      activeProfileId: state.activeProfileId,
      pinCode: state.pinCode,
      lockedCategories: Array.from(state.lockedCategories)
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tv-player-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSettingsStatus('Exported settings and favorites backup.', 'success');
  }

  async function importBackupJson(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.settings) {
        Object.assign(state.settings, data.settings);
        saveSettings();
        el.prefUseProxy.checked = Boolean(state.settings.useProxy);
        el.prefOsdTimeout.value = String(state.settings.osdTimeout);
      }
      if (data.favorites) {
        loadFavoriteStore(data.favorites);
        saveFavorites();
      }
      if (Array.isArray(data.recents)) {
        state.recents = data.recents;
        saveRecents();
      }
      if (Array.isArray(data.profiles)) {
        state.profiles = data.profiles;
        state.activeProfileId = data.activeProfileId || '';
        saveProfilesStorage();
        renderProfiles();
      }
      if (typeof data.pinCode === 'string') {
        state.pinCode = data.pinCode;
        if (state.pinCode) localStorage.setItem(STORAGE_KEYS.PIN_CODE, state.pinCode);
        else localStorage.removeItem(STORAGE_KEYS.PIN_CODE);
      }
      if (Array.isArray(data.lockedCategories)) {
        state.lockedCategories = new Set(data.lockedCategories);
        localStorage.setItem(STORAGE_KEYS.LOCKED_CATS, JSON.stringify(data.lockedCategories));
      }
      updatePinStatusUi();
      state.keyMap = buildDefaultKeyMap();
      renderKeyMapper();
      renderCategories();
      filterAndRenderChannels();
      setSettingsStatus('Backup restored successfully.', 'success');
    } catch (err) {
      setSettingsStatus(`Failed to import backup: ${err.message}`, 'error');
    }
  }

  // Event Wiring
  function bindEvents() {
    document.addEventListener('keydown', handleKeyDown);
    el.playerStage.addEventListener('mousemove', showOsd);
    el.playerStage.addEventListener('click', (e) => {
      if (e.target === el.video) togglePlayPause();
    });

    function getBufferedAheadSeconds(v) {
      if (!v || !v.buffered || v.buffered.length === 0) return 0;
      const t = v.currentTime || 0;
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= t + 0.15 && v.buffered.end(i) >= t) {
          return Math.max(0, v.buffered.end(i) - t);
        }
      }
      return 0;
    }

    function updateBufferProgress(setBufferingLabel = false) {
      const ahead = getBufferedAheadSeconds(el.video);
      const targetWindow = state.hls
        ? Math.max(4, Math.min((state.hls.config && state.hls.config.maxBufferLength) || 30, 10))
        : 4;
      const bufferedPct = Math.min(100, Math.round((ahead / targetWindow) * 100));
      const pct = Math.max(bufferedPct, Math.min(99, state.fragLoadPercent || 0));
      if (el.bufferPercent) el.bufferPercent.textContent = `${pct}%`;
      if (setBufferingLabel) {
        el.loadingText.textContent = `Buffering... ${pct}%`;
      }
      return pct;
    }

    function showBufferingOverlay() {
      if (!state.currentChannel || state.userPaused) return;
      updateBufferProgress(true);
      el.loadingOverlay.style.display = '';
      el.loadingOverlay.classList.remove('hidden');
    }

    function hideBufferingOverlay() {
      state.fragLoadPercent = 0;
      if (el.bufferPercent) el.bufferPercent.textContent = '0%';
      el.loadingOverlay.classList.add('hidden');
      el.loadingOverlay.style.display = 'none';
      if (document.body) document.body.classList.add('video-playing');
    }

    el.video.addEventListener('playing', () => {
      state.reconnectAttempts = 0;
      el.video.style.display = 'block';
      el.video.style.opacity = '1';
      el.video.style.visibility = 'visible';
      el.emptyOverlay.classList.add('hidden');
      hideBufferingOverlay();
      updateOsd();
      updateDiagnostics();
    });
    el.video.addEventListener('loadeddata', () => {
      el.video.style.display = 'block';
      el.video.style.opacity = '1';
      el.video.style.visibility = 'visible';
      hideBufferingOverlay();
    });
    el.video.addEventListener('canplay', () => {
      hideBufferingOverlay();
    });
    el.video.addEventListener('waiting', showBufferingOverlay);
    el.video.addEventListener('stalled', showBufferingOverlay);
    el.video.addEventListener('seeking', () => {
      if (state.currentChannel && !state.userPaused) {
        showBufferingOverlay();
      }
    });
    el.video.addEventListener('seeked', () => {
      hideBufferingOverlay();
      updateSeekUi();
    });
    el.video.addEventListener('progress', () => {
      if (!el.loadingOverlay.classList.contains('hidden')) {
        updateBufferProgress(false);
      }
    });
    el.video.addEventListener('error', () => {
      if (el.video.onerror) return;
      if (state.currentChannel && el.video.getAttribute('src') && !state.userPaused) {
        const errCode = el.video.error ? el.video.error.code : 0;
        if (errCode === 3 || errCode === 4) {
          clearTimeout(state.reconnectTimer);
          state.reconnectTimer = null;
          clearTimeout(state.startupRetryTimer);
          state.startupRetryTimer = null;
          el.loadingText.textContent = `Unsupported codec/container (MediaError ${errCode})`;
          el.loadingOverlay.style.display = '';
    el.loadingOverlay.classList.remove('hidden');
          return;
        }
        if (state.osdSeeking || el.video.seeking) {
          return;
        }
        scheduleReconnect();
      }
    });
    el.video.addEventListener('loadedmetadata', () => {
      if (el.video.readyState >= 2) hideBufferingOverlay();
      updateOsd();
    });
    el.video.addEventListener('timeupdate', () => {
      if (!el.loadingOverlay.classList.contains('hidden') && (el.video.currentTime > 0 || el.video.readyState >= 2)) {
        hideBufferingOverlay();
      }
      updateSeekUi();
    });
    el.video.addEventListener('pause', () => {
      updateOsd();
      showOsd();
    });
    el.video.addEventListener('play', () => {
      state.userPaused = false;
      updateOsd();
      showOsd();
    });

    el.emptySetupBtn.addEventListener('click', openSettings);
    el.emptyChannelsBtn.addEventListener('click', openDrawer);
    el.btnOpenChannels.addEventListener('click', openDrawer);
    el.btnOpenGuide.addEventListener('click', openEpg);
    el.btnOpenSettings.addEventListener('click', openSettings);
    const toggleFullscreen = () => {
      toggleFullscreenMode();
    };
    el.btnFullscreen.addEventListener('click', toggleFullscreen);
    if (el.dvrSetupCancelBtn) el.dvrSetupCancelBtn.addEventListener('click', closeDvrScheduleModal);
    if (el.dvrSetupNextBtn) el.dvrSetupNextBtn.addEventListener('click', showDvrConfirmStep);
    if (el.dvrConfirmCancelBtn) el.dvrConfirmCancelBtn.addEventListener('click', closeDvrScheduleModal);
    if (el.dvrConfirmSubmitBtn) el.dvrConfirmSubmitBtn.addEventListener('click', submitDvrSchedule);
    if (el.dvrScheduleModal) {
      el.dvrScheduleModal.addEventListener('click', (e) => {
        if (e.target === el.dvrScheduleModal) closeDvrScheduleModal();
      });
    }
    if (el.dvrKeepBtn) el.dvrKeepBtn.addEventListener('click', closeDvrCancelModal);
    if (el.dvrConfirmCancelRecordBtn) el.dvrConfirmCancelRecordBtn.addEventListener('click', submitDvrCancel);
    if (el.dvrCancelModal) {
      el.dvrCancelModal.addEventListener('click', (e) => {
        if (e.target === el.dvrCancelModal) closeDvrCancelModal();
      });
    }
    if (el.btnExitApp) el.btnExitApp.addEventListener('click', openExitModal);
    if (el.exitCancelBtn) el.exitCancelBtn.addEventListener('click', closeExitModal);
    if (el.exitConfirmBtn) el.exitConfirmBtn.addEventListener('click', confirmAppExit);
    if (el.exitModal) {
      el.exitModal.addEventListener('click', (e) => {
        if (e.target === el.exitModal) closeExitModal();
      });
    }
    const osdFsBtn = document.getElementById('osdFullscreenBtn');
    if (osdFsBtn) osdFsBtn.addEventListener('click', toggleFullscreen);

    el.osdPrevBtn.addEventListener('click', () => zapChannel(-1));
    el.osdNextBtn.addEventListener('click', () => zapChannel(1));
    el.osdAspectBtn.addEventListener('click', cycleAspectRatio);
    el.osdRecordBtn.addEventListener('click', toggleDvrRecording);
    el.osdStatsBtn.addEventListener('click', toggleDiagnostics);
    if (el.osdGuideBtn) el.osdGuideBtn.addEventListener('click', openChannelGuide);
    if (el.btnOsdSplitGuide) el.btnOsdSplitGuide.addEventListener('click', toggleSplitGuide);
    if (el.btnCloseSplitGuide) el.btnCloseSplitGuide.addEventListener('click', closeSplitGuide);
    window.addEventListener('resize', () => {
      if (document.body.classList.contains('split-guide-open')) {
        syncSplitGuideViewport();
      }
    });
    if (typeof ResizeObserver === 'function' && el.splitGuidePanel) {
      const splitResizeObserver = new ResizeObserver(() => {
        if (document.body.classList.contains('split-guide-open')) {
          syncSplitGuideViewport();
        }
      });
      splitResizeObserver.observe(el.splitGuidePanel);
    }
    if (el.chGuideCloseBtn) el.chGuideCloseBtn.addEventListener('click', closeChannelGuide);
    if (el.chGuideFullGridBtn) el.chGuideFullGridBtn.addEventListener('click', openEpg);
    if (el.chGuideLiveBtn) {
      el.chGuideLiveBtn.addEventListener('click', () => {
        const ch = state.currentChannel;
        closeChannelGuide();
        if (ch) playChannel(ch);
      });
    }
    if (el.channelGuideModal) {
      el.channelGuideModal.addEventListener('click', (e) => {
        if (e.target === el.channelGuideModal) closeChannelGuide();
      });
    }
    initMpvBridge();

    el.osdAudioSelect.addEventListener('change', (e) => {
      if (state.mpvActive) {
        postMpvCommand('mpv:audio', { id: String(e.target.value || 'auto') });
        showOsd();
        return;
      }
      const idx = Number(e.target.value);
      if (state.hls && idx >= 0) {
        state.hls.audioTrack = idx;
      }
      showOsd();
    });
    el.osdSubSelect.addEventListener('change', (e) => {
      const val = String(e.target.value);
      if (state.mpvActive) {
        postMpvCommand('mpv:sub', { id: val === '-1' ? 'no' : val });
        showOsd();
        return;
      }
      if (val.startsWith('ext_')) {
        const extIdx = Number(val.slice(4));
        if (state.hls) state.hls.subtitleTrack = -1;
        if (el.video.textTracks) {
          for (let i = 0; i < el.video.textTracks.length; i++) {
            el.video.textTracks[i].mode = i === extIdx ? 'showing' : 'disabled';
          }
        }
      } else {
        const idx = Number(val);
        if (state.hls) state.hls.subtitleTrack = idx;
        if (el.video.textTracks) {
          for (let i = 0; i < el.video.textTracks.length; i++) {
            if (state.hls || idx < 0) el.video.textTracks[i].mode = 'disabled';
            else el.video.textTracks[i].mode = i === idx ? 'showing' : 'disabled';
          }
        }
      }
      showOsd();
    });
    el.osdSubLoadBtn.addEventListener('click', () => el.osdSubFileInput.click());
    el.osdSubFileInput.addEventListener('change', (e) => {
      loadExternalSubtitleFile(e.target.files[0]);
      e.target.value = '';
    });
    el.osdSubDelayMinusBtn.addEventListener('click', () => adjustSubtitleOffset(-100));
    el.osdSubDelayPlusBtn.addEventListener('click', () => adjustSubtitleOffset(100));
    el.osdPlayPauseBtn.addEventListener('click', togglePlayPause);
    if (el.osdStopBtn) {
      el.osdStopBtn.addEventListener('click', stopPlayback);
    }
    if (el.osdSeekBar) {
      let seekTooltip = el.osdSeekRow ? el.osdSeekRow.querySelector('.osd-seek-tooltip') : null;
      if (!seekTooltip && el.osdSeekRow) {
        seekTooltip = document.createElement('div');
        seekTooltip.className = 'osd-seek-tooltip hidden';
        el.osdSeekRow.appendChild(seekTooltip);
      }
      const updateSeekTooltip = (clientX, ratioOverride = null) => {
        const total = getMediaDurationSeconds();
        if (!seekTooltip || total <= 0) return;
        const rect = el.osdSeekBar.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = ratioOverride !== null
          ? Math.max(0, Math.min(1, ratioOverride))
          : Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const hoverSec = ratio * total;
        const clock = formatDurationClock(hoverSec);
        const catchup = state.currentCatchupProgram;
        const label = (catchup && catchup.start)
          ? `${clock} • ${formatTime(catchup.start + (hoverSec * 1000))}`
          : clock;
        seekTooltip.textContent = label;
        el.osdSeekBar.title = label;
        const rowRect = el.osdSeekRow.getBoundingClientRect();
        const leftPx = (rect.left - rowRect.left) + (ratio * rect.width);
        seekTooltip.style.left = `${leftPx}px`;
        seekTooltip.classList.remove('hidden');
      };
      const hideSeekTooltip = () => {
        if (seekTooltip) seekTooltip.classList.add('hidden');
      };
      const commitSeek = () => {
        const total = getMediaDurationSeconds();
        if (total > 0) {
          const pct = Math.max(0, Math.min(100, Number(el.osdSeekBar.value) || 0));
          el.osdSeekBar.style.setProperty('--seek-pct', `${pct.toFixed(1)}%`);
          const target = Math.max(0, Math.min(total, (pct / 100) * total));
          if (Number.isFinite(target)) {
            seekToMediaSeconds(target);
            return;
          }
        }
        updateSeekUi();
        showOsd();
      };
      el.osdSeekBar.addEventListener('mousedown', () => { state.osdSeeking = true; });
      el.osdSeekBar.addEventListener('touchstart', () => { state.osdSeeking = true; }, { passive: true });
      el.osdSeekBar.addEventListener('mouseup', () => { state.osdSeeking = false; });
      el.osdSeekBar.addEventListener('touchend', () => { state.osdSeeking = false; hideSeekTooltip(); }, { passive: true });
      el.osdSeekBar.addEventListener('mousemove', (e) => { updateSeekTooltip(e.clientX); });
      el.osdSeekBar.addEventListener('mouseleave', hideSeekTooltip);
      el.osdSeekBar.addEventListener('blur', hideSeekTooltip);
      el.osdSeekBar.addEventListener('input', () => {
        state.osdSeeking = true;
        const total = getMediaDurationSeconds();
        const pct = Math.max(0, Math.min(100, Number(el.osdSeekBar.value) || 0));
        el.osdSeekBar.style.setProperty('--seek-pct', `${pct.toFixed(1)}%`);
        if (total > 0 && el.osdCurrentTime) {
          el.osdCurrentTime.textContent = formatDurationClock((pct / 100) * total);
        }
        updateSeekTooltip(0, pct / 100);
        showOsd();
      });
      el.osdSeekBar.addEventListener('change', () => {
        state.osdSeeking = false;
        hideSeekTooltip();
        commitSeek();
      });
      el.osdSeekBar.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          const total = getMediaDurationSeconds();
          if (total > 0) {
            const delta = e.key === 'ArrowRight' ? 10 : -10;
            seekToMediaSeconds(getMediaPositionSeconds() + delta, { relativeDelta: delta });
          }
          showOsd();
        }
      });
    }
    el.osdMuteBtn.addEventListener('click', () => {
      if (state.mpvActive) {
        state.mpvMuted = !state.mpvMuted;
        postMpvCommand('mpv:mute', { muted: state.mpvMuted });
      } else {
        el.video.muted = !el.video.muted;
      }
      updateOsd();
    });
    el.osdFavBtn.addEventListener('click', () => toggleFavorite());

    el.contentModeTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      setContentMode(btn.dataset.mode || 'live');
    });
    el.btnSeriesBack.addEventListener('click', () => {
      state.activeSeries = null;
      state.seriesEpisodes = [];
      el.seriesBackBar.classList.add('hidden');
      filterAndRenderChannels();
    });
    if (el.btnTelegramBack) {
      el.btnTelegramBack.addEventListener('click', () => {
        state.activeTgChannel = null;
        state.tgVideos = [];
        if (el.telegramBackBar) el.telegramBackBar.classList.add('hidden');
        filterAndRenderChannels();
      });
    }
    if (el.btnNetshareBack) {
      el.btnNetshareBack.addEventListener('click', () => {
        if (!state.activeNetShare) return;
        const cur = (state.netShareSubpath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!cur) {
          state.activeNetShare = null;
          state.netShareFolders = [];
          state.netShareFiles = [];
          if (el.netshareBackBar) el.netshareBackBar.classList.add('hidden');
          filterAndRenderChannels();
          return;
        }
        const parts = cur.split('/');
        parts.pop();
        browseNetShare(state.activeNetShare, parts.join('/'));
      });
    }
    if (el.netshareAddBtn) el.netshareAddBtn.addEventListener('click', addNetShare);
    if (el.netsharePassToggleBtn && el.netsharePassInput) {
      el.netsharePassToggleBtn.addEventListener('click', () => {
        const isPass = el.netsharePassInput.type === 'password';
        el.netsharePassInput.type = isPass ? 'text' : 'password';
        el.netsharePassToggleBtn.textContent = isPass ? 'Hide' : 'Show';
      });
    }

    el.btnCloseDrawer.addEventListener('click', closeDrawer);
    if (el.favModalCloseBtn) {
      el.favModalCloseBtn.addEventListener('click', closeFavFolderModal);
    }
    if (el.favRemoveItemBtn) {
      el.favRemoveItemBtn.addEventListener('click', () => {
        if (state.favMoveTargetKey) {
          const label = state.favPickerChannel ? state.favPickerChannel.name : 'item';
          removeChannelFromFavorites(state.favMoveTargetKey, label);
          closeFavFolderModal();
        }
      });
    }
    if (el.favCreateFolderBtn && el.favNewFolderInput) {
      const handleCreate = () => {
        const created = createFavoriteFolder(el.favNewFolderInput.value);
        if (created) {
          el.favNewFolderInput.value = '';
          if (state.favPickerChannel) {
            assignChannelToFavoriteFolder(state.favPickerChannel, created.id);
            closeFavFolderModal();
          } else if (state.favMoveTargetKey) {
            moveFavoriteItemToFolder(state.favMoveTargetKey, created.id);
            closeFavFolderModal();
          }
        }
      };
      el.favCreateFolderBtn.addEventListener('click', handleCreate);
      el.favNewFolderInput.addEventListener('input', () => setFavFolderValidation(''));
      el.favNewFolderInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          handleCreate();
        }
      });
    }
    let searchDebounceTimer = null;
    el.channelSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      const trimmed = state.searchQuery.trim();
      clearTimeout(searchDebounceTimer);
      if (state.contentMode === 'telegram' && state.tgAuthenticated) {
        clearTimeout(state.tgSearchTimer);
        if (!trimmed) {
          if (state.tgSearchAbort) {
            state.tgSearchAbort.abort();
            state.tgSearchAbort = null;
          }
          state.tgGlobalVideos = [];
          if (state.activeTgChannel) {
            loadTelegramVideos(state.activeTgChannel, '');
          } else {
            searchDebounceTimer = setTimeout(filterAndRenderChannels, 150);
          }
          return;
        }
        searchDebounceTimer = setTimeout(filterAndRenderChannels, 150);
        state.tgSearchTimer = setTimeout(() => {
          if (state.activeTgChannel) {
            loadTelegramVideos(state.activeTgChannel, trimmed);
          } else if (trimmed.length >= 2) {
            searchTelegramGlobal(trimmed);
          } else {
            state.tgGlobalVideos = [];
            filterAndRenderChannels();
          }
        }, 350);
        return;
      }
      searchDebounceTimer = setTimeout(filterAndRenderChannels, 150);
    });

    el.btnCloseEpg.addEventListener('click', closeEpg);
    el.epgPrevWindowBtn.addEventListener('click', () => {
      state.epgWindowStart -= 2 * 60 * 60 * 1000;
      renderEpgGrid();
    });
    el.epgNowBtn.addEventListener('click', () => {
      state.epgWindowStart = getFloorHalfHour(Date.now());
      renderEpgGrid();
    });
    el.epgNextWindowBtn.addEventListener('click', () => {
      state.epgWindowStart += 2 * 60 * 60 * 1000;
      renderEpgGrid();
    });
    el.epgWatchBtn.addEventListener('click', () => {
      if (state.epgSelectedChannel) {
        const ch = state.epgSelectedChannel;
        const p = state.epgSelectedProgram;
        if (p && p.stop <= Date.now() && hasCatchupSupport(ch)) {
          if (playCatchupProgram(ch, p)) {
            closeEpg();
            return;
          }
        }
        playChannel(ch);
        closeEpg();
      }
    });

    el.savePinBtn.addEventListener('click', () => {
      const val = (el.pinSetupInput.value || '').trim();
      if (!/^\d{4}$/.test(val)) {
        setSettingsStatus('Parental PIN must be exactly 4 digits.', 'error');
        return;
      }
      state.pinCode = val;
      state.unlockedCategories.clear();
      localStorage.setItem(STORAGE_KEYS.PIN_CODE, val);
      el.pinSetupInput.value = '';
      updatePinStatusUi();
      state.keyMap = buildDefaultKeyMap();
      renderKeyMapper();
      renderCategories();
      setSettingsStatus('4-digit Parental PIN saved.', 'success');
    });

    el.clearPinBtn.addEventListener('click', () => {
      state.pinCode = '';
      state.unlockedCategories.clear();
      localStorage.removeItem(STORAGE_KEYS.PIN_CODE);
      el.pinSetupInput.value = '';
      updatePinStatusUi();
      state.keyMap = buildDefaultKeyMap();
      renderKeyMapper();
      renderCategories();
      setSettingsStatus('Parental PIN lock disabled.', 'success');
    });

    el.pinKeypad.addEventListener('click', (e) => {
      const keyBtn = e.target.closest('.pin-key');
      if (!keyBtn) return;
      if (keyBtn.dataset.digit !== undefined) {
        handlePinDigit(keyBtn.dataset.digit);
      } else if (keyBtn.dataset.action === 'clear') {
        state.pinBuffer = '';
        el.pinErrorText.classList.add('hidden');
        updatePinDots();
      } else if (keyBtn.dataset.action === 'cancel') {
        closePinModal();
      }
    });

    window.addEventListener('beforeunload', teardownActiveStream);

    el.btnCloseSettings.addEventListener('click', closeSettings);
    el.settingsTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      cancelKeyCapture();
      const tabId = btn.dataset.tab;
      el.settingsTabs.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach((p) => {
        p.classList.toggle('active', p.id === tabId);
      });
      renderSettingsTab(tabId);
    });

    el.loadM3uUrlBtn.addEventListener('click', () => loadM3uFromUrl(el.m3uUrlInput.value));
    el.m3uFileInput.addEventListener('change', (e) => loadM3uFromFile(e.target.files[0]));
    el.loadXtreamBtn.addEventListener('click', loadXtreamCodes);
    el.loadEpgUrlBtn.addEventListener('click', () => loadEpgFromUrl(el.epgUrlInput.value));
    el.epgFileInput.addEventListener('change', (e) => loadEpgFromFile(e.target.files[0]));
    el.saveProfileBtn.addEventListener('click', saveCurrentProfile);
    el.exportBackupBtn.addEventListener('click', exportBackupJson);
    el.importBackupInput.addEventListener('change', (e) => importBackupJson(e.target.files[0]));

    el.prefUseProxy.addEventListener('change', () => {
      state.settings.useProxy = el.prefUseProxy.checked;
      saveSettings();
      showToast(`CORS Relay Proxy ${state.settings.useProxy ? 'enabled' : 'disabled'}`);
    });
    el.prefOsdTimeout.addEventListener('change', () => {
      state.settings.osdTimeout = Number(el.prefOsdTimeout.value) || 3000;
      saveSettings();
    });

    el.epgReminderBtn.addEventListener('click', toggleReminderForSelection);
    const tabTelegramEl = document.getElementById('tabTelegram');
    if (tabTelegramEl) {
      tabTelegramEl.addEventListener('click', (e) => {
        if (e.target.closest('#tgQrStartBtn')) {
          startTelegramQrAuth();
        } else if (e.target.closest('#tgQrCancelBtn')) {
          cancelTelegramQrAuth();
        } else if (e.target.closest('#tgQrPasswordBtn')) {
          submitTelegramQrPassword();
        } else if (e.target.closest('#tgLogoutBtn')) {
          logoutTelegramAuth();
        }
      });
    }
    if (el.resetKeyMapBtn) {
      el.resetKeyMapBtn.addEventListener('click', resetKeyMap);
    }
    if (el.cancelKeyCaptureBtn) {
      el.cancelKeyCaptureBtn.addEventListener('click', cancelKeyCapture);
    }
    el.clearDataBtn.addEventListener('click', async () => {
      teardownActiveStream();
      state.channels = [];
      state.vodItems = [];
      state.seriesItems = [];
      state.seriesEpisodes = [];
      state.activeSeries = null;
      state.filteredChannels = [];
      state.categories = [];
      state.favorites.clear();
      state.favoriteStore = { folders: [{ id: 'general', name: 'General', order: 0 }], items: [] };
      state.activeFavFolderId = 'ALL';
      state.recents = [];
      state.recentItems = {};
      state.reminders = [];
      state.pinCode = '';
      state.lockedCategories.clear();
      state.unlockedCategories.clear();
      state.currentChannel = null;
      state.epgMap = Object.create(null);
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
      await dbClear();
      el.playlistBadge.textContent = 'No Playlist';
      el.epgSummaryText.textContent = 'No EPG data loaded.';
      el.emptyOverlay.classList.remove('hidden');
      el.emptyChannelsBtn.classList.add('hidden');
      updatePinStatusUi();
      state.keyMap = buildDefaultKeyMap();
      renderKeyMapper();
      renderCategories();
      filterAndRenderChannels();
      updateOsd();
      setSettingsStatus('All saved playlists, EPG data, and favorites have been cleared.', 'success');
    });

    if (el.factoryResetBtn && el.confirmFactoryResetBtn && el.cancelFactoryResetBtn) {
      const resetConfirmUi = (confirming) => {
        el.factoryResetBtn.classList.toggle('hidden', confirming);
        el.confirmFactoryResetBtn.classList.toggle('hidden', !confirming);
        el.cancelFactoryResetBtn.classList.toggle('hidden', !confirming);
      };

      el.factoryResetBtn.addEventListener('click', () => {
        resetConfirmUi(true);
        setSettingsStatus('Warning: Confirm Full Wipe will erase all settings, playlists, favorites, and sessions.', 'error');
        el.confirmFactoryResetBtn.focus();
      });

      el.cancelFactoryResetBtn.addEventListener('click', () => {
        resetConfirmUi(false);
        setSettingsStatus('Factory reset cancelled.', 'info');
        el.factoryResetBtn.focus();
      });

      el.confirmFactoryResetBtn.addEventListener('click', async () => {
        el.confirmFactoryResetBtn.disabled = true;
        setSettingsStatus('Wiping all app data and resetting to factory defaults...', 'info');
        try {
          teardownActiveStream();
          await abortStaleProxyConnections();
        } catch (_) {}
        try {
          await fetch('/tg/auth/logout', { method: 'POST' });
        } catch (_) {}
        try {
          localStorage.clear();
        } catch (_) {}
        try {
          await dbClear();
          if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
            const dbs = await window.indexedDB.databases();
            await Promise.all((dbs || []).map((d) => new Promise((resolve) => {
              if (!d || !d.name) return resolve();
              const req = window.indexedDB.deleteDatabase(d.name);
              req.onsuccess = resolve;
              req.onerror = resolve;
              req.onblocked = resolve;
            })));
          } else if (window.indexedDB) {
            await new Promise((resolve) => {
              const req = window.indexedDB.deleteDatabase(DB_NAME);
              req.onsuccess = resolve;
              req.onerror = resolve;
              req.onblocked = resolve;
            });
          }
        } catch (_) {}
        window.location.reload();
      });
    }
  }

  // Telegram Account & Media Source
  function setTgInlineStatus(message, type = 'info') {
    const color = type === 'error' ? '#ef4444' : (type === 'success' ? '#22c55e' : '#38bdf8');
    if (el.tgAuthStatus) {
      el.tgAuthStatus.textContent = message || '';
      el.tgAuthStatus.style.color = message ? color : '';
    }
    if (el.tgInlineStatus) {
      el.tgInlineStatus.textContent = message || '';
      el.tgInlineStatus.style.color = message ? color : '';
    }
    if (message) {
      setSettingsStatus(message, type);
    }
  }

  function updateTelegramAuthUi() {
    if (!el.tgStatusBadge) return;
    if (state.tgAuthenticated && state.tgUser) {
      const displayName = [state.tgUser.firstName, state.tgUser.lastName].filter(Boolean).join(' ') ||
        state.tgUser.username ||
        state.tgUser.phone ||
        'Telegram User';
      el.tgStatusBadge.textContent = `Connected as ${displayName}`;
      el.tgStatusBadge.classList.add('is-connected');
      if (el.tgLogoutBtn) el.tgLogoutBtn.classList.remove('hidden');
      if (el.tgQrStartBtn) el.tgQrStartBtn.classList.add('hidden');
      if (el.tgQrCancelBtn) el.tgQrCancelBtn.classList.add('hidden');
      if (el.tgQrContainer) el.tgQrContainer.classList.add('hidden');
      if (el.tgQrPasswordSection) el.tgQrPasswordSection.classList.add('hidden');
    } else {
      el.tgStatusBadge.textContent = 'Disconnected';
      el.tgStatusBadge.classList.remove('is-connected');
      if (el.tgLogoutBtn) el.tgLogoutBtn.classList.add('hidden');
      if (el.tgQrStartBtn) el.tgQrStartBtn.classList.remove('hidden');
      if (el.tgQrStartBtn) {
        el.tgQrStartBtn.textContent = state.tgQrActive ? 'Refresh QR Code' : 'Connect with QR Code';
      }
      if (el.tgQrCancelBtn) el.tgQrCancelBtn.classList.toggle('hidden', !state.tgQrActive && !state.tgQrPasswordRequired);
      if (el.tgQrContainer) el.tgQrContainer.classList.toggle('hidden', !state.tgQrActive || state.tgQrPasswordRequired);
      if (el.tgQrPasswordSection) el.tgQrPasswordSection.classList.toggle('hidden', !state.tgQrPasswordRequired);
    }
  }

  async function loadTelegramChannels() {
    if (!state.tgAuthenticated) {
      state.tgChannels = [];
      renderCategories();
      if (state.contentMode === 'telegram') filterAndRenderChannels();
      return;
    }
    try {
      const resp = await fetch('/tg/channels', { cache: 'no-store' });
      if (!resp.ok) return;
      const data = await resp.json();
      state.tgChannels = Array.isArray(data.channels) ? data.channels : [];
      renderCategories();
      if (state.contentMode === 'telegram') filterAndRenderChannels();
    } catch (err) {
      console.warn('Failed to load Telegram channels:', err);
    }
  }

  async function refreshTelegramStatus() {
    try {
      const resp = await fetch('/tg/status', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      state.tgAuthenticated = Boolean(data.authenticated);
      state.tgUser = data.user || null;
      updateTelegramAuthUi();
      if (state.tgAuthenticated) {
        await loadTelegramChannels();
      }
    } catch (_) {
      state.tgAuthenticated = false;
      state.tgUser = null;
      updateTelegramAuthUi();
    }
  }

  let tgQrPollTimer = null;

  function stopTgQrPolling() {
    if (tgQrPollTimer) {
      clearInterval(tgQrPollTimer);
      tgQrPollTimer = null;
    }
  }

  function getTgApiBase() {
    return (window.location && /^https?:\/\//i.test(window.location.origin))
      ? window.location.origin
      : 'http://127.0.0.1:8765';
  }

  async function parseTgJsonResponse(resp) {
    const raw = await resp.text();
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      return { data: {}, parseError: `Empty response body (HTTP ${resp.status})` };
    }
    try {
      return { data: JSON.parse(trimmed), parseError: null };
    } catch (_) {
      const snippet = trimmed.slice(0, 120).replace(/\s+/g, ' ');
      return { data: {}, parseError: `Non-JSON response (HTTP ${resp.status}): ${snippet}` };
    }
  }

  function renderTgQrSvg(svgMarkup, expiresEpochSec) {
    if (el.tgQrSvgBox && svgMarkup) {
      el.tgQrSvgBox.innerHTML = svgMarkup;
      const svgEl = el.tgQrSvgBox.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.display = 'block';
      }
    }
    if (el.tgQrTimer) {
      const secsLeft = expiresEpochSec ? Math.max(0, Math.round(expiresEpochSec - (Date.now() / 1000))) : 30;
      el.tgQrTimer.textContent = `Auto-refreshes automatically (~${secsLeft}s remaining)`;
    }
  }

  async function pollTelegramQrStatus() {
    try {
      const resp = await fetch(`${getTgApiBase()}/tg/qr/status`, { cache: 'no-store' });
      const { data } = await parseTgJsonResponse(resp);
      if (!resp.ok || !data.ok) return;

      if (data.status === 'authenticated' || data.authenticated) {
        stopTgQrPolling();
        state.tgQrActive = false;
        state.tgQrPasswordRequired = false;
        if (el.tgPasswordInput) el.tgPasswordInput.value = '';
        await refreshTelegramStatus();
        setTgInlineStatus('Connected to Telegram! Your subscribed channels are ready.', 'success');
        showToast('Telegram connected!');
        return;
      }

      if (data.status === 'password_required') {
        state.tgQrActive = false;
        state.tgQrPasswordRequired = true;
        updateTelegramAuthUi();
        setTgInlineStatus('2FA Cloud Password required. Enter your password and click Submit.', 'info');
        if (el.tgPasswordInput) el.tgPasswordInput.focus();
        return;
      }

      if (data.status === 'waiting_scan' && data.qrSvg) {
        state.tgQrActive = true;
        state.tgQrPasswordRequired = false;
        renderTgQrSvg(data.qrSvg, data.expires);
        updateTelegramAuthUi();
        return;
      }

      if (data.status === 'error') {
        stopTgQrPolling();
        state.tgQrActive = false;
        state.tgQrPasswordRequired = false;
        updateTelegramAuthUi();
        const errMsg = data.error || 'Telegram QR login failed';
        setTgInlineStatus(errMsg, 'error');
        showToast(errMsg);
      }
    } catch (_) {}
  }

  async function startTelegramQrAuth() {
    stopTgQrPolling();
    state.tgQrActive = false;
    state.tgQrPasswordRequired = false;
    if (el.tgPasswordInput) el.tgPasswordInput.value = '';
    setTgInlineStatus('Generating Telegram QR code...', 'info');
    showToast('Generating Telegram QR code...');
    try {
      const resp = await fetch(`${getTgApiBase()}/tg/qr/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const { data, parseError } = await parseTgJsonResponse(resp);
      if (!resp.ok || !data.ok || !data.qrSvg) {
        throw new Error(data.error || parseError || `HTTP ${resp.status}`);
      }
      state.tgQrActive = true;
      state.tgQrPasswordRequired = false;
      renderTgQrSvg(data.qrSvg, data.expires);
      updateTelegramAuthUi();
      setTgInlineStatus('Scan the QR code in Telegram: Settings -> Devices -> Link Desktop Device.', 'info');
      tgQrPollTimer = setInterval(pollTelegramQrStatus, 1500);
    } catch (err) {
      state.tgQrActive = false;
      state.tgQrPasswordRequired = false;
      updateTelegramAuthUi();
      const errText = `QR login error: ${err.message}`;
      setTgInlineStatus(errText, 'error');
      showToast(errText);
    }
  }

  async function submitTelegramQrPassword() {
    const password = (el.tgPasswordInput && el.tgPasswordInput.value) || '';
    if (!password) {
      setTgInlineStatus('Please enter your 2FA cloud password.', 'error');
      return;
    }
    setTgInlineStatus('Verifying 2FA password...', 'info');
    try {
      const resp = await fetch(`${getTgApiBase()}/tg/qr/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const { data, parseError } = await parseTgJsonResponse(resp);
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || parseError || `HTTP ${resp.status}`);
      }
      if (!tgQrPollTimer) {
        tgQrPollTimer = setInterval(pollTelegramQrStatus, 1000);
      }
    } catch (err) {
      setTgInlineStatus(`2FA failed: ${err.message}`, 'error');
    }
  }

  async function cancelTelegramQrAuth() {
    stopTgQrPolling();
    state.tgQrActive = false;
    state.tgQrPasswordRequired = false;
    if (el.tgQrSvgBox) el.tgQrSvgBox.innerHTML = '';
    if (el.tgPasswordInput) el.tgPasswordInput.value = '';
    try {
      await fetch(`${getTgApiBase()}/tg/qr/cancel`, { method: 'POST' });
    } catch (_) {}
    updateTelegramAuthUi();
    setTgInlineStatus('QR login cancelled.', 'info');
  }

  async function logoutTelegramAuth() {
    stopTgQrPolling();
    setTgInlineStatus('Disconnecting Telegram session...', 'info');
    try {
      await fetch(`${getTgApiBase()}/tg/auth/logout`, { method: 'POST' });
    } catch (_) {}
    state.tgQrActive = false;
    state.tgQrPasswordRequired = false;
    state.tgAuthenticated = false;
    state.tgUser = null;
    state.tgChannels = [];
    state.activeTgChannel = null;
    state.tgVideos = [];
    updateTelegramAuthUi();
    renderCategories();
    if (state.contentMode === 'telegram') filterAndRenderChannels();
    setTgInlineStatus('Disconnected from Telegram.', 'info');
    showToast('Telegram disconnected');
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  async function runStartupHealthChecks() {
    const TIMEOUT_MS = 4000;

    const checkNetwork = async () => {
      const online = navigator.onLine !== false;
      try {
        const res = await fetchWithTimeout('/health', { method: 'HEAD', cache: 'no-store' }, TIMEOUT_MS);
        if (res.ok) return online ? 'Net OK' : 'Net Local';
      } catch (_) {}
      return online ? 'Net Degraded' : 'Net Offline';
    };

    const checkChannelsRefresh = async () => {
      const activeCount = Array.isArray(state.sources) ? state.sources.filter((s) => s.enabled !== false).length : 0;
      const meta = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLIST_META) || '{}');
      if (!activeCount && !meta.m3uUrl && !meta.epgUrl) {
        return 'Channels Local';
      }
      return state.isStartupRefreshing ? 'Channels Syncing' : 'Channels Ready';
    };

    const checkTelegram = async () => 'TG On-Demand';

    const checkSmbShares = async () => {
      try {
        await Promise.race([
          loadNetSharesList(),
          new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS))
        ]);
        const shares = Array.isArray(state.netShares) ? state.netShares : [];
        if (!shares.length) return 'SMB None';
        const probes = await Promise.allSettled(
          shares.map((s) =>
            fetchWithTimeout(`/netshare/browse?shareId=${encodeURIComponent(s.id)}&subpath=`, { cache: 'no-store' }, TIMEOUT_MS)
              .then((r) => r.ok)
          )
        );
        const okCount = probes.filter((p) => p.status === 'fulfilled' && p.value === true).length;
        return `SMB ${okCount}/${shares.length}`;
      } catch (_) {
        return 'SMB Error';
      }
    };

    const results = await Promise.allSettled([
      checkNetwork(),
      checkChannelsRefresh(),
      checkTelegram(),
      checkSmbShares()
    ]);

    const summary = results
      .map((r) => (r.status === 'fulfilled' ? r.value : 'Check Failed'))
      .join(' | ');
    showToast(`Startup: ${summary}`, 4200);
  }

  const TACTICAL_CATEGORY_THEMES = {
    live: { prop: 'live', hex: '#38BDF8', rgb: '56, 189, 248' },
    catchup: { prop: 'catchup', hex: '#22D3EE', rgb: '34, 211, 238' },
    favorites: { prop: 'favorites', hex: '#F59E0B', rgb: '245, 158, 11' },
    telegram: { prop: 'telegram', hex: '#10B981', rgb: '16, 185, 129' },
    netshare: { prop: 'network', hex: '#60A5FA', rgb: '96, 165, 250' },
    network: { prop: 'network', hex: '#60A5FA', rgb: '96, 165, 250' },
    setup: { prop: 'setup', hex: '#FB923C', rgb: '251, 146, 60' }
  };

  function syncTacticalCategoryProp(categoryKey) {
    const key = String(categoryKey || 'live').toLowerCase();
    const theme = TACTICAL_CATEGORY_THEMES[key] || TACTICAL_CATEGORY_THEMES.live;
    if (document.body) {
      document.body.setAttribute('data-tactical-prop', theme.prop);
    }
    if (document.documentElement) {
      document.documentElement.style.setProperty('--accent', theme.hex);
      document.documentElement.style.setProperty('--accent-rgb', theme.rgb);
      document.documentElement.style.setProperty('--accent-glow', `rgba(${theme.rgb}, 0.42)`);
    }
    state.tacticalAccentRgb = theme.rgb;
    const stage = document.getElementById('tacticalPropStage');
    if (stage) {
      stage.querySelectorAll('[data-prop]').forEach((node) => {
        const isMatch = node.dataset.prop === theme.prop;
        node.classList.toggle('is-active', isMatch);
        node.classList.toggle('active', isMatch);
      });
    }
    if (typeof state.redrawTacticalGrid === 'function') {
      state.redrawTacticalGrid();
    }
  }

  function initTacticalFxEngine() {
    const canvas = document.getElementById('tacticalFxCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const drawStaticGrid = () => {
      const isPlaying = document.hidden || (document.body && (document.body.classList.contains('video-playing') || document.body.classList.contains('mpv-playing')));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = canvas.getBoundingClientRect();
      const nextW = Math.max(1, Math.floor(rect.width * dpr));
      const nextH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      width = nextW;
      height = nextH;

      ctx.clearRect(0, 0, width, height);
      if (isPlaying) return;

      const rgb = state.tacticalAccentRgb || '56, 189, 248';
      const step = Math.max(48, Math.floor(width / 18));
      ctx.strokeStyle = `rgba(${rgb}, 0.055)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = step; x < width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = step; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    };

    state.pauseTacticalFx = () => {
      if (width > 0 && height > 0) {
        ctx.clearRect(0, 0, width, height);
      }
    };
    state.redrawTacticalGrid = drawStaticGrid;

    drawStaticGrid();
    window.addEventListener('resize', drawStaticGrid, { passive: true });
  }

  function initTacticalCardTilt() {
    if (state.tacticalTiltBound) return;
    state.tacticalTiltBound = true;
    document.addEventListener('mousemove', (e) => {
      const card = e.target && e.target.closest ? e.target.closest('.channel-card, .channel-item') : null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
      const rotX = (-ny * 5).toFixed(2);
      const rotY = (nx * 5).toFixed(2);
      card.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px) translateZ(18px) scale(1.025)`;
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      const card = e.target && e.target.closest ? e.target.closest('.channel-card, .channel-item') : null;
      if (!card) return;
      if (!e.relatedTarget || !card.contains(e.relatedTarget)) {
        card.style.transform = '';
      }
    }, { passive: true });
  }

  // Initialization
  async function init() {
    loadLocalPreferences();
    bindEvents();
    state.isFullscreen = Boolean(window.chrome && window.chrome.webview);
    updateFullscreenButtons();
    syncTacticalCategoryProp(state.contentMode || 'live');
    initTacticalFxEngine();
    initTacticalCardTilt();
    updateClock();
    let bgTickCount = 0;
    setInterval(() => {
      if (document.hidden) return;
      bgTickCount++;
      const typing = isTypingInSetupForm();
      const mpvPlaying = document.body && (document.body.classList.contains('video-playing') || document.body.classList.contains('mpv-playing'));
      const osdHidden = el.playerStage && el.playerStage.classList.contains('osd-hidden');
      if (el.diagnosticsPanel && !el.diagnosticsPanel.classList.contains('hidden')) {
        updateDiagnostics();
      }
      if (!typing && !(mpvPlaying && osdHidden) && (bgTickCount % 15 === 0)) {
        updateClock();
      }
      if (!typing && (bgTickCount % 10 === 0)) {
        checkDueReminders();
      }
      if (!typing && !osdHidden && (bgTickCount % 30 === 0) && state.currentChannel) {
        updateOsd();
      }
    }, 1000);
    setInterval(pollGamepads, 60);

    const [, dbResults] = await Promise.all([
      waitForProxyReady(),
      Promise.all([
        dbGet('epg'),
        dbGet('channels'),
        dbGet('vodItems'),
        dbGet('seriesItems'),
        dbGet('reminders')
      ])
    ]);
    const [savedEpg, savedChannels, savedVod, savedSeries, savedReminders] = dbResults;
    if (Array.isArray(savedVod)) state.vodItems = savedVod;
    if (Array.isArray(savedSeries)) state.seriesItems = savedSeries;
    if (Array.isArray(savedReminders)) state.reminders = savedReminders;
    if (savedEpg && savedEpg.epgMap) {
      const windowed = pruneEpgMapWindow(savedEpg.epgMap);
      state.epgMap = windowed.epgMap;
      state.epgChannelCount = windowed.channelCount;
      state.epgProgramCount = windowed.programCount;
      state.epgChannelNames = savedEpg.channelNames || null;
      state.epgLastUpdatedMs = Number(savedEpg.updatedAt) || 0;
      buildEpgLookupIndex(state.epgMap, state.epgChannelNames);
      savedEpg.epgMap = null;
      el.epgSummaryText.textContent = `Loaded ${state.epgProgramCount.toLocaleString()} programs across ${state.epgChannelCount.toLocaleString()} channels (${savedEpg.sourceLabel || 'Saved'}).`;
    }

    if (Array.isArray(savedChannels) && savedChannels.length > 0) {
      await applyChannels(savedChannels, 'Saved Playlist', { isStartupResume: true });
    } else {
      el.emptySetupBtn.focus();
    }

    // Non-blocking startup playlist/EPG refresh (25s timeout) & 4s health-checks
    setTimeout(() => {
      loadDvrSchedulesFromServer().catch(() => {});
      refreshStartupPlaylistAndEpg().catch(() => {});
      runStartupHealthChecks().catch(() => {});
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
