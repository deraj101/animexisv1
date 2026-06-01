// @ts-nocheck
/**
 * Userstats.js — Server-backed user stats (replaces AsyncStorage)
 *
 * All reads/writes go to /api/stats/* and are persisted in MongoDB.
 * The JWT is attached automatically by the API service (Authorization header).
 *
 * Public API is unchanged so ProfileScreen, PlayerScreen, etc. need no edits.
 */

import API from './api';

// ─── INTERNAL: fetch all stats once and cache in memory for the session ───────
let _statsCache = null;

async function _getStats() {
  if (_statsCache) return _statsCache;
  try {
    const res = await API.get('/api/stats/all');
    if (res.data.success) {
      _statsCache = res.data.stats;
      return _statsCache;
    }
  } catch { /* fall through */ }
  return null;
}

function _bust() { _statsCache = null; }

// ─── EPISODES ─────────────────────────────────────────────────────────────────
/** Record one unique episode as watched. Returns new total count. */
export const recordEpisode = async (_email, episodeId) => {
  try {
    const res = await API.post('/api/stats/episode', { episodeId });
    _bust();
    return res.data.episodeCount ?? 0;
  } catch { return 0; }
};

/** Return the count of unique episodes watched. */
export const getEpisodeCount = async (_email) => {
  const stats = await _getStats();
  return stats?.episodes ?? 0;
};

// ─── WATCH TIME ───────────────────────────────────────────────────────────────
/** Add seconds to cumulative watch-time. */
export const addWatchTime = async (_email, seconds) => {
  try {
    await API.post('/api/stats/watchtime', { seconds });
    _bust();
  } catch { /* non-critical */ }
};

/** Return total watch-time as a human-readable string (e.g. "138h" or "45m"). */
export const getWatchTimeFormatted = async (_email) => {
  const stats = await _getStats();
  return stats?.watchTime ?? '0s';
};

export const getWatchTimeSeconds = async (_email) => {
  const stats = await _getStats();
  return stats?.watchTimeRaw ?? 0;
};

// ─── FAVORITES ────────────────────────────────────────────────────────────────
/** Toggle favorite. Returns { isFavorited: bool, count: number }. */
export const toggleFavorite = async (_email, anime) => {
  try {
    const res = await API.post('/api/stats/favorite', {
      id:    anime.id,
      title: anime.title,
      image: anime.image,
    });
    _bust();
    return { isFavorited: res.data.isFavorited, count: res.data.count };
  } catch { return { isFavorited: false, count: 0 }; }
};

/** Check if an anime is favorited — reads from cache, very fast. */
export const isFavorited = async (_email, animeId) => {
  const stats = await _getStats();
  if (!stats?.favorites) return false;
  return stats.favorites.some(f => String(f.id) === String(animeId));
};

export const getFavoriteCount = async (_email) => {
  const stats = await _getStats();
  return stats?.favCount ?? 0;
};

export const getFavorites = async (_email) => {
  const stats = await _getStats();
  return stats?.favorites ?? [];
};

// ─── RATINGS ──────────────────────────────────────────────────────────────────
/** Save a 1–5 star rating (0 to clear). Returns new avg string. */
export const rateAnime = async (_email, animeId, rating) => {
  try {
    const res = await API.post('/api/stats/rate', { animeId, rating });
    _bust();
    return res.data.avgRating ?? '—';
  } catch { return '—'; }
};

/** Get the stored rating for a specific anime (0 if unrated). */
export const getAnimeRating = async (_email, animeId) => {
  const stats = await _getStats();
  // ratings is returned as a plain object { animeId: number } from .lean()
  const ratings = stats?.ratings || {};
  return ratings[String(animeId)] ?? 0;
};

/** Average of all user ratings (1 decimal, or "—"). */
export const getAvgRating = async (_email) => {
  const stats = await _getStats();
  return stats?.avgRating ?? '—';
};

// ─── USERNAME ─────────────────────────────────────────────────────────────────
export const getUsername = async (_email) => {
  const stats = await _getStats();
  return stats?.username ?? _email?.split('@')[0] ?? 'Viewer';
};

export const setUsername = async (_email, name) => {
  try {
    // Profile update goes through the existing /api/auth/update-profile endpoint
    await API.post('/api/auth/update-profile', { email: _email, name: name.trim() });
    _bust();
  } catch { /* ignore */ }
};

export const setProfileImage = async (_email, uri) => {
  try {
    await API.post('/api/auth/update-profile', { email: _email, profile_image: uri });
    _bust();
  } catch (err) {
    console.error('[Userstats] Failed to save profile image to server:', err.message);
  }
};

export const setProfileBorder = async (_email, border) => {
  try {
    await API.post('/api/auth/update-profile', { email: _email, profile_border: border });
    _bust();
  } catch (err) {
    console.error('[Userstats] Failed to save profile border to server:', err.message);
  }
};

// ─── SETTINGS ────────────────────────────────────────────────────────────────
export const getSettings = async (_email) => {
  const stats = await _getStats();
  return stats?.settings ?? { notifications: true, autoplay: true, hd: false, subtitles: true };
};

export const saveSettings = async (_email, settings) => {
  try {
    await API.put('/api/stats/settings', settings);
    _bust();
  } catch { /* non-critical */ }
};

// ─── HISTORY ──────────────────────────────────────────────────────────────────
export const clearWatchHistory = async (_email) => {
  try {
    await API.delete('/api/stats/history');
    _bust();
  } catch { /* ignore */ }
};

// ─── ALL STATS (batch load for ProfileScreen) ────────────────────────────────
export const getAllStats = async (_email) => {
  _bust(); // always fetch fresh when profile screen explicitly requests all stats
  const stats = await _getStats();
  if (!stats) return { episodes: 0, watchTime: '0s', favCount: 0, avgRating: '—', username: _email?.split('@')[0] ?? 'Viewer' };
  return {
    episodes:  stats.episodes,
    watchTime: stats.watchTime,
    favCount:  stats.favCount,
    avgRating: stats.avgRating,
    username:  stats.username,
    profile_border: stats.profile_border,
  };
};