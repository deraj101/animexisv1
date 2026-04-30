import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { C } from '../theme';
import * as NotificationApi from '../services/notificationApi';
import API from '../services/api';
import { SkeletonList } from '../components/SkeletonGrid';

const NotificationItem = ({ item, onPress }) => {
  const getIcon = () => {
    switch (item.type) {
      case 'LIKE':    return { name: 'heart', color: '#ff4b6b' };
      case 'REPLY':   return { name: 'chatbubble-ellipses', color: '#4ba3ff' };
      case 'RELEASE': return { name: 'play-circle', color: C.crimson };
      case 'SUPPORT_REPLY': return { name: 'shield-checkmark', color: '#22c55e' };
      default:        return { name: 'notifications', color: C.dim };
    }
  };

  const icon = getIcon();

  return (
    <TouchableOpacity 
      style={[styles.item, !item.isRead && styles.unreadItem]} 
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: `${icon.color}15` }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>
      
      <View style={styles.content}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.itemMessage} numberOfLines={2}>{item.message}</Text>
      </View>

      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    const res = await NotificationApi.getNotifications();
    if (res.success) {
      setNotifications(res.notifications);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (item) => {
    // 1. Mark as read immediately in UI
    if (!item.isRead) {
      setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true } : n));
      NotificationApi.markAsRead(item._id).catch(() => {});
    }

    const isCommentAction = item.type === 'LIKE' || item.type === 'REPLY';

    // 2. Navigate based on type
    if (item.type === 'SUPPORT_REPLY') {
      Alert.alert(item.title, item.message);
      return;
    }

    if (item.episodeNum) {
      // Find episode info and Go to Player
      try {
        setLoading(true);
        const detailsRes = await API.get(`/api/anime/details/${item.refId}`);
        const episode = detailsRes.data.episodes?.find(e => String(e.episodeNumber) === String(item.episodeNum));
        
        if (episode?.url) {
          const infoRes = await API.get(`/api/anime/episode-info?url=${encodeURIComponent(episode.url)}`);
          navigation.navigate("Player", {
            video: episode.url,
            title: `Episode ${item.episodeNum}`,
            animeTitle: detailsRes.data.title,
            episodeNumber: item.episodeNum,
            episodeData: infoRes.data,
            animeId: item.refId,
            animeImage: detailsRes.data.image,
            scrollToComments: isCommentAction
          });
        } else {
            // Fallback to details if episode not found
            navigation.navigate("Details", { id: item.refId, scrollToComments: isCommentAction });
        }
      } catch (err) {
        navigation.navigate("Details", { id: item.refId, scrollToComments: isCommentAction });
      } finally {
        setLoading(false);
      }
    } else {
      // LIKE or REPLY -> Go to Details screen
      navigation.navigate("Details", { id: item.refId, scrollToComments: isCommentAction });
    }
  };

  const handleMarkAllRead = async () => {
    const res = await NotificationApi.markAllRead();
    if (res.success) {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      </BlurView>

      {loading && notifications.length === 0 ? (
        <SkeletonList count={10} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item._id}
          renderItem={({ item }) => <NotificationItem item={item} onPress={handleNotificationPress} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.crimson} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={48} color={C.dimmer} />
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 50 : 20, 
    paddingBottom: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: C.border,
    zIndex: 10
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { color: C.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  markAllBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  markAllText: { color: C.crimson, fontSize: 13, fontWeight: '600' },

  listContent: { paddingVertical: 10 },
  item: { 
    flexDirection: 'row', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    gap: 12
  },
  unreadItem: { backgroundColor: 'rgba(220,20,60,0.03)' },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  itemTitle: { color: C.white, fontSize: 14, fontWeight: '700' },
  itemTime: { color: C.dimmer, fontSize: 10 },
  itemMessage: { color: C.dim, fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.crimson },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { padding: 80, alignItems: 'center', gap: 15 },
  emptyText: { color: C.dimmer, fontSize: 14, fontWeight: '500' }
});
