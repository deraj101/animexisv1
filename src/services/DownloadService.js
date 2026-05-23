import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

const DOWNLOADS_KEY = 'animexis_offline_downloads';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}downloads/`;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL. Premium downloads need the deployed API URL.');
}
const DOWNLOAD_FORMAT_VERSION = 2;

class DownloadService {
    constructor() {
        this.activeDownloads = new Map(); // requestId -> DownloadResumable
    }

    async init() {
        if (Platform.OS === 'web') return;
        const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
        }
    }

    async getDownloads() {
        try {
            const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    async saveDownloads(downloads) {
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
    }

    async startDownload(episode, anime, onProgress) {
        if (Platform.OS === 'web') {
            Alert.alert("Not Supported", "Downloads are only available on mobile devices.");
            return;
        }

        await this.init(); // Ensure directory exists
        const downloads = await this.getDownloads();
        const existing = downloads.find(d => d.id === this._getEpId(anime.id, episode.number));
        if (existing && existing.status === 'completed') {
            const fileInfo = await FileSystem.getInfoAsync(existing.localUri);
            if (fileInfo.exists) {
                Alert.alert("Already Downloaded", "This episode is already available offline.");
                return;
            }
        }

        // 1. Get the direct video URL
        // In a real app, you'd call your API to get the source. 
        // We expect the caller to provide the direct URL or we fetch it here.
        const videoUrl = episode.directUrl; 
        if (!videoUrl) {
            throw new Error("No direct video URL found for download.");
        }

        let fileExt = 'mp4';
        const urlWithoutQuery = videoUrl.split('?')[0];
        const lastPart = urlWithoutQuery.split('.').pop().toLowerCase();
        
        if (videoUrl.includes('/download-m3u8') && videoUrl.includes('format=ts')) {
            fileExt = 'ts';
        } else
        if (['mp4', 'mkv', 'webm', 'm3u8', 'mov', 'avi'].includes(lastPart)) {
            fileExt = lastPart;
        }

        // ⚠️ WARNING: m3u8 files are playlists, downloading them directly will only save the playlist, not segments.
        // In a production app, you'd need an HLS downloader. For now, we'll try to download as is.
        
        const safeAnimeId = anime.id.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeAnimeId}_ep${episode.number}.${fileExt}`;
        const fileUri = DOWNLOAD_DIR + fileName;

        let lastProgressUpdate = 0;

        const callback = (downloadProgress) => {
            const expected = downloadProgress.totalBytesExpectedToWrite;
            const written = downloadProgress.totalBytesWritten || 0;

            // Throttle updates to every 150ms to avoid UI jank
            const now = Date.now();
            if (now - lastProgressUpdate < 150 && written > 0) return;
            lastProgressUpdate = now;

            let progress;
            const writtenMB = (written / (1024 * 1024)).toFixed(1);

            if (expected > 0) {
                // Known size — use real ratio, cap at 0.99 so the UI
                // doesn't flash "100%" before the file is verified
                progress = Math.min(0.99, written / expected);
            } else {
                // Unknown size — smooth asymptotic curve: 1 - 1/(1 + x)
                // where x grows with bytes written. This reaches:
                //   ~50% at 10 MB, ~80% at 40 MB, ~90% at 90 MB,
                //   ~95% at 190 MB, ~99% at 990 MB
                // Much smoother than the old log10 formula that capped at 95%
                const x = written / (10 * 1024 * 1024); // normalize to ~10MB units
                progress = Math.min(0.99, 1 - 1 / (1 + x));
            }

            if (onProgress) {
                onProgress({
                    progress,
                    written,
                    expected,
                    writtenMB,
                    isUnknown: expected <= 0
                });
            }
        };

        // 🚀 NEW: Get JWT token to authenticate the download proxy request
        let authToken = '';
        if (this._isOwnApiUrl(videoUrl)) {
            try {
                const rawAuth = await AsyncStorage.getItem("auth_user");
                if (rawAuth) {
                    const parsed = JSON.parse(rawAuth);
                    if (parsed.token) {
                        authToken = `Bearer ${parsed.token}`;
                    }
                }
            } catch (e) {
                console.error("Failed to read auth token for download:", e);
            }
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ...(authToken ? { 'Authorization': authToken } : {})
        };

        if (!this._isOwnApiUrl(videoUrl)) {
            headers.Referer = videoUrl.split('/').slice(0, 3).join('/');
        }

        const downloadResumable = FileSystem.createDownloadResumable(
            videoUrl,
            fileUri,
            { headers },
            callback
        );

        const requestId = this._getEpId(anime.id, episode.number);
        this.activeDownloads.set(requestId, downloadResumable);

        try {
            const result = await downloadResumable.downloadAsync();
            const { uri, status, headers = {} } = result || {};
            const contentType = String(headers['content-type'] || headers['Content-Type'] || '').toLowerCase();

            if (!uri || (status && (status < 200 || status >= 300))) {
                await this._deleteIfExists(uri);
                throw new Error(`Download failed: server returned ${status || 'an invalid response'}.`);
            }

            if (contentType.includes('application/json') || contentType.includes('text/html')) {
                await this._deleteIfExists(uri);
                throw new Error("Download failed: the server returned an error page instead of a video file.");
            }

            // Brief 100% update so UI shows completion before the alert
            if (onProgress) onProgress({ progress: 1, written: 0, expected: 0, isUnknown: false });
            
            // 🚀 NEW: Verify file size
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (!fileInfo.exists || fileInfo.size < 100 * 1024) { // Less than 100KB
                await this._deleteIfExists(uri);
                throw new Error("Download failed: The file is too small or invalid. This usually happens when the source is protected or a playlist (HLS).");
            }

            const newDownload = {
                id: requestId,
                animeId: anime.id,
                animeTitle: anime.title,
                animeImage: anime.image,
                episodeNumber: episode.number,
                episodeTitle: episode.title,
                quality: episode.downloadQuality || 'Auto',
                localUri: uri,
                fileSize: fileInfo.size,
                status: 'completed',
                formatVersion: DOWNLOAD_FORMAT_VERSION,
                downloadedAt: Date.now()
            };

            const updated = [...downloads.filter(d => d.id !== requestId), newDownload];
            await this.saveDownloads(updated);
            this.activeDownloads.delete(requestId);
            return newDownload;
        } catch (e) {
            console.error("Download failed:", e);
            this.activeDownloads.delete(requestId);
            throw e;
        }
    }

    async deleteDownload(id) {
        const downloads = await this.getDownloads();
        const item = downloads.find(d => d.id === id);
        if (item) {
            try {
                await FileSystem.deleteAsync(item.localUri, { idempotent: true });
            } catch (e) {
                console.error("Failed to delete file:", e);
            }
            const updated = downloads.filter(d => d.id !== id);
            await this.saveDownloads(updated);
        }
    }

    async isDownloaded(animeId, epNumber) {
        const downloads = await this.getDownloads();
        const item = downloads.find(d => d.id === this._getEpId(animeId, epNumber));
        if (!item) return false;
        const info = await FileSystem.getInfoAsync(item.localUri);
        return info.exists;
    }

    _getEpId(animeId, epNumber) {
        return `${animeId}_ep${epNumber}`;
    }

    _isOwnApiUrl(url) {
        return !!url && !!API_BASE_URL && url.startsWith(API_BASE_URL);
    }

    async _deleteIfExists(uri) {
        if (!uri) return;
        try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {}
    }

    async isBroken(item) {
        try {
            if (Platform.OS === 'web') return false;
            const info = await FileSystem.getInfoAsync(item.localUri);
            if (!info.exists) return true;
            if ((item.formatVersion || 1) < DOWNLOAD_FORMAT_VERSION) return true;
            // 0.0MB or very small files are broken
            if (info.size < 1024 * 100) return true; 
            return false;
        } catch {
            return true;
        }
    }
}

export default new DownloadService();
