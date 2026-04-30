import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image'; // 🖼️ NEW
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import PremiumBorder from '../components/PremiumBorder'; // 🎨 NEW
import { C } from '../theme';
import API from '../services/api';
import { SkeletonProfile } from '../components/SkeletonGrid';

const { width } = Dimensions.get('window');

const ActivityTimelineItem = ({ item, onPress }) => {
  const isComment = item.type === 'COMMENT';
  const icon = isComment ? 'chatbubble-ellipses-outline' : 'play-outline';
  const color = isComment ? '#4ba3ff' : C.crimson;

  return (
    <TouchableOpacity style={styles.activityItem} activeOpacity={0.7} onPress={() => onPress(item)}>
      <View style={styles.timelineLine} />
      <View style={[styles.activityIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={12} color={color} />
      </View>
      <View style={styles.activityContent}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>
            {isComment ? 'Commented' : 'Watched episode'}
          </Text>
          <Text style={styles.activityTime}>{new Date(item.ts).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.activityName} numberOfLines={1}>
          {isComment ? `on ${item.animeId}` : item.title}
        </Text>
        {isComment && (
          <View style={styles.commentPreview}>
            <Text style={styles.commentText} numberOfLines={2}>"{item.text}"</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function PublicProfileScreen({ route, navigation }) {
  const { email } = route.params;
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [pRes, aRes] = await Promise.all([
        API.get(`/api/users/public-profile/${email}`),
        API.get(`/api/users/public-activity/${email}`)
      ]);
      if (pRes.data.success) setProfile(pRes.data.profile);
      if (aRes.data.success) setActivity(aRes.data.activity);
    } catch (err) {
      console.error('Fetch profile failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [email]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleActivityPress = (item) => {
    navigation.pop(); // Close modal
    setTimeout(() => {
      navigation.navigate("Details", { id: item.animeId });
    }, 100);
  };

  return (
    <View style={styles.outerContainer}>
      {/* ── BACKDROP ── */}
      <Pressable style={styles.backdrop} onPress={() => navigation.goBack()} />

      {/* ── CENTERED PROFILE CARD ── */}
      <View style={styles.cardContainer}>
        <BlurView intensity={95} tint="dark" style={styles.card}>
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeBtn} 
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={C.white} />
          </TouchableOpacity>

          {loading && !profile ? (
            <SkeletonProfile />
          ) : !profile ? (
            <View style={styles.center}>
              <Text style={{ color: C.dim }}>User not found.</Text>
            </View>
          ) : (
            <FlatList
              data={activity}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => <ActivityTimelineItem item={item} onPress={handleActivityPress} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.crimson} />}
              ListHeaderComponent={
                <View style={styles.header}>
                  <View style={styles.avatarWrap}>
                    <PremiumBorder borderStyle={profile.profile_border} size={80} borderWidth={2}>
                      <View style={styles.avatarInner}>
                        {profile.profile_image ? (
                          <Image 
                            source={{ uri: profile.profile_image }} 
                            style={styles.avatar} 
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <LinearGradient colors={['#444', '#222']} style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarLetter}>{profile.name[0]}</Text>
                          </LinearGradient>
                        )}
                      </View>
                    </PremiumBorder>
                    {profile.subscription === 'premium' && (
                      <View style={styles.premiumBadge}>
                        <Ionicons name="star" size={8} color="#000" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.name}>{profile.name}</Text>
                  <View style={styles.badgeRow}>
                    {profile.isMod && (
                      <View style={styles.modBadge}>
                        <Text style={styles.modText}>MODERATOR</Text>
                      </View>
                    )}
                    <Text style={styles.joinedAt}>Member since {new Date(profile.joined_at).getFullYear()}</Text>
                  </View>
                  <View style={styles.separator} />
                  <Text style={styles.sectionTitle}>Recent Activity</Text>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>Nothing here yet.</Text>
                </View>
              }
            />
          )}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  
  cardContainer: { width: width * 0.85, maxHeight: '80%', borderRadius: 24, overflow: 'hidden', elevation: 20 },
  card: { 
    padding: 20, 
    borderRadius: 24, 
    backgroundColor: 'rgba(25,25,30,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  closeBtn: { position: 'absolute', top: 15, right: 15, zIndex: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },

  header: { alignItems: 'center', marginBottom: 5 },
  avatarWrap: { position: 'relative', marginBottom: 12, justifyContent: 'center', alignItems: 'center' },
  avatarInner: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden' },
  avatar: { width: 80, height: 80 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: C.white, fontSize: 36, fontWeight: '800' },
  premiumBadge: { 
    position: 'absolute', bottom: 2, right: 2, 
    backgroundColor: '#FFD700', width: 16, height: 16, 
    borderRadius: 8, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: C.bg
  },
  
  name: { color: C.white, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, justifyContent: 'center' },
  modBadge: { backgroundColor: C.crimson, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  modText: { color: C.white, fontSize: 8, fontWeight: '900' },
  joinedAt: { color: C.dim, fontSize: 11 },

  separator: { width: '40%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 15 },
  sectionTitle: { color: C.white, fontSize: 12, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8, alignSelf: 'flex-start' },
  
  listContent: { paddingBottom: 20 },
  activityItem: { flexDirection: 'row', paddingBottom: 18 },
  timelineLine: { 
    position: 'absolute', left: 11, top: 16, 
    bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' 
  },
  activityIcon: { 
    width: 24, height: 24, borderRadius: 12, 
    justifyContent: 'center', alignItems: 'center', zIndex: 1 
  },
  activityContent: { flex: 1, marginLeft: 10 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activityTitle: { color: C.dim, fontSize: 10, fontWeight: '600' },
  activityTime: { color: C.dimmer, fontSize: 9 },
  activityName: { color: C.white, fontSize: 13, fontWeight: '700', marginTop: 1 },
  commentPreview: { 
    marginTop: 4, backgroundColor: 'rgba(255,255,255,0.02)', 
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' 
  },
  commentText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontStyle: 'italic', lineHeight: 15 },

  center: { height: 150, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { padding: 20, alignItems: 'center' },
  emptyText: { color: C.dimmer, fontSize: 12 }
});
