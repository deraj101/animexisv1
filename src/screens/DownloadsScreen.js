import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import DownloadService from "../services/DownloadService";
import { C } from "../theme";

export default function DownloadsScreen() {
  const navigation = useNavigation();
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDownloads = useCallback(async () => {
    setLoading(true);
    let list = await DownloadService.getDownloads();
    
    // 🚀 NEW: Verify downloads and cleanup broken ones
    const verifiedList = [];
    let changed = false;
    
    for (const item of list) {
      const isBroken = await DownloadService.isBroken(item);
      if (!isBroken) {
        verifiedList.push(item);
      } else {
        console.log(`[DownloadsScreen] Cleanup: Removing broken download for ${item.animeTitle}`);
        await DownloadService.deleteDownload(item.id);
        changed = true;
      }
    }
    
    const finalList = changed ? verifiedList : list;
    setDownloads(finalList.sort((a, b) => b.downloadedAt - a.downloadedAt));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  const handleDelete = (id, title) => {
    Alert.alert(
      "Delete Download",
      `Are you sure you want to remove "${title}" from your offline storage?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            await DownloadService.deleteDownload(id);
            fetchDownloads();
          }
        }
      ]
    );
  };

  const handlePlay = (item) => {
    navigation.navigate("Player", {
      video: item.localUri,
      title: item.episodeTitle || `Episode ${item.episodeNumber}`,
      animeTitle: item.animeTitle,
      episodeNumber: item.episodeNumber,
      animeId: item.animeId,
      animeImage: item.animeImage,
      isOffline: true,
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.cardMain} 
        onPress={() => handlePlay(item)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.animeImage }} style={styles.poster} contentFit="cover" />
        <View style={styles.info}>
          <Text style={styles.animeTitle} numberOfLines={1}>{item.animeTitle}</Text>
          <Text style={styles.epTitle} numberOfLines={1}>
            Episode {item.episodeNumber} {item.episodeTitle ? `· ${item.episodeTitle}` : ""}
          </Text>
          <Text style={styles.meta}>
            {(item.fileSize / (1024 * 1024)).toFixed(1)} MB · Downloaded {new Date(item.downloadedAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.playIcon}>
          <Ionicons name="play" size={18} color="white" />
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.deleteBtn}
        onPress={() => handleDelete(item.id, item.animeTitle)}
      >
        <Ionicons name="trash-outline" size={20} color={C.dim} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offline Downloads</Text>
      </BlurView>

      <FlatList
        data={downloads}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Ionicons name="cloud-download-outline" size={64} color={C.surfaceHigh} />
              <Text style={styles.emptyTitle}>No downloads found</Text>
              <Text style={styles.emptySub}>Episodes you download for offline viewing will appear here.</Text>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={fetchDownloads}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { marginRight: 15 },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  list: { padding: 15, paddingBottom: 100 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  cardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  poster: { width: 50, height: 70, borderRadius: 8, backgroundColor: C.surfaceHigh },
  info: { flex: 1, marginLeft: 12, marginRight: 8 },
  animeTitle: { color: "white", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  epTitle: { color: C.dim, fontSize: 13, fontWeight: "500", marginBottom: 4 },
  meta: { color: C.dimmer, fontSize: 11 },
  playIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.crimson,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  deleteBtn: {
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: C.border,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 150, paddingHorizontal: 40 },
  emptyTitle: { color: "white", fontSize: 18, fontWeight: "700", marginTop: 20 },
  emptySub: { color: C.dim, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
