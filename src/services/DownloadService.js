import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

const DOWNLOADS_KEY = 'animexis_offline_downloads';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}downloads/`;

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
        
        if (['mp4', 'mkv', 'webm', 'm3u8', 'mov', 'avi'].includes(lastPart)) {
            fileExt = lastPart;
        }

        // ⚠️ WARNING: m3u8 files are playlists, downloading them directly will only save the playlist, not segments.
        // In a production app, you'd need an HLS downloader. For now, we'll try to download as is.
        
        const safeAnimeId = anime.id.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeAnimeId}_ep${episode.number}.${fileExt}`;
        const fileUri = DOWNLOAD_DIR + fileName;

        const callback = (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            if (onProgress) onProgress(progress);
        };

        // 🚀 NEW: Get JWT token to authenticate the download proxy request
        let authToken = '';
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

        const downloadResumable = FileSystem.createDownloadResumable(
            videoUrl,
            fileUri,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': videoUrl.split('/').slice(0, 3).join('/'),
                    ...(authToken ? { 'Authorization': authToken } : {})
                }
            },
            callback
        );

        const requestId = this._getEpId(anime.id, episode.number);
        this.activeDownloads.set(requestId, downloadResumable);

        try {
            const { uri } = await downloadResumable.downloadAsync();
            
            // 🚀 NEW: Verify file size
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (!fileInfo.exists || fileInfo.size < 100 * 1024) { // Less than 100KB
                await FileSystem.deleteAsync(uri, { idempotent: true });
                throw new Error("Download failed: The file is too small or invalid. This usually happens when the source is protected or a playlist (HLS).");
            }

            const newDownload = {
                id: requestId,
                animeId: anime.id,
                animeTitle: anime.title,
                animeImage: anime.image,
                episodeNumber: episode.number,
                episodeTitle: episode.title,
                localUri: uri,
                fileSize: fileInfo.size,
                status: 'completed',
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

    async isBroken(item) {
        try {
            if (Platform.OS === 'web') return false;
            const info = await FileSystem.getInfoAsync(item.localUri);
            if (!info.exists) return true;
            // 0.0MB or very small files are broken
            if (info.size < 1024 * 100) return true; 
            return false;
        } catch (e) {
            return true;
        }
    }
}

export default new DownloadService();
