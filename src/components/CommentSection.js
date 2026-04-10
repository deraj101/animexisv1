import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  Animated,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import PremiumBorder from './PremiumBorder';
import { C } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as CommentApi from '../services/commentApi';
import DotCircleLoader from './DotCircleLoader';

// ── Relative time helper ──────────────────────────────────────────────────────
function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Avatar helper ─────────────────────────────────────────────────────────────
function Avatar({ uri, email, size = 36, border = null }) {
  const src = uri || `https://api.dicebear.com/7.x/avataaars/png?seed=${email}`;
  return (
    <PremiumBorder borderStyle={border} size={size} borderWidth={2}>
      <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.overlay }} contentFit="cover" />
    </PremiumBorder>
  );
}

// ── Single Comment Item ───────────────────────────────────────────────────────
const CommentItem = React.memo(function CommentItem({
  comment, depth = 0, currentUser,
  onReply, onLike, onDelete, replyingTo, setReplyingTo,
}) {
  const navigation = useNavigation();
  const isOwn    = comment.userEmail === currentUser?.email;
  const isLiked  = comment.likes?.includes(currentUser?.email);
  const likeAnim = useRef(new Animated.Value(1)).current;

  const handleLike = useCallback(async () => {
    Animated.sequence([
      Animated.timing(likeAnim, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(likeAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
    await onLike(comment._id);
  }, [comment._id, onLike]);

  const isReplying = replyingTo === comment._id;

  return (
    <View style={[styles.commentBlock, depth > 0 && styles.replyBlock]}>
      {/* Avatar column */}
      <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { email: comment.userEmail })} activeOpacity={0.8}>
        <Avatar uri={comment.profileImage} email={comment.userEmail} size={depth > 0 ? 30 : 38} border={comment.profileBorder} />
      </TouchableOpacity>

      {/* Content column */}
      <View style={{ flex: 1 }}>
        {/* Name + time */}
        <View style={styles.commentMeta}>
          <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { email: comment.userEmail })} activeOpacity={0.8}>
            <Text style={styles.commentAuthor}>{comment.userName}</Text>
          </TouchableOpacity>
          {comment.isMod && (
            <View style={styles.modPill}>
              <Ionicons name="shield-checkmark" size={8} color={C.crimson} />
              <Text style={styles.modPillText}>ADMIN</Text>
            </View>
          )}
          {comment.isPremium && !comment.isMod && (
            <View style={[styles.modPill, { borderColor: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
              <Ionicons name="star" size={8} color="#fbbf24" />
              <Text style={[styles.modPillText, { color: '#fbbf24' }]}>PREMIUM</Text>
            </View>
          )}
          <Text style={styles.commentTime}>{relTime(comment.ts)}</Text>
        </View>

        {/* Body */}
        <Text style={styles.commentBody}>{comment.text}</Text>

        {/* Actions */}
        <View style={styles.commentActions}>
          {/* Like */}
          <TouchableOpacity style={styles.actionPill} onPress={handleLike} disabled={!currentUser} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: likeAnim }] }}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={14} color={isLiked ? C.crimson : C.dim} />
            </Animated.View>
            {comment.likes?.length > 0 && (
              <Text style={[styles.actionPillText, isLiked && { color: C.crimson }]}>{comment.likes.length}</Text>
            )}
          </TouchableOpacity>

          {/* Reply (only 1 level deep like YT) */}
          {depth === 0 && currentUser && (
            <TouchableOpacity style={styles.actionPill} onPress={() => setReplyingTo(isReplying ? null : comment._id)} activeOpacity={0.7}>
              <Ionicons name="chatbubble-outline" size={13} color={isReplying ? C.crimson : C.dim} />
              <Text style={[styles.actionPillText, isReplying && { color: C.crimson }]}>Reply</Text>
              {comment.replies?.length > 0 && !isReplying && (
                <Text style={[styles.actionPillText, { color: C.dimmer }]}>· {comment.replies.length}</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Delete (own comment) */}
          {isOwn && (
            <TouchableOpacity style={styles.actionPill} onPress={() => onDelete(comment._id)} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={13} color={C.dimmer} />
            </TouchableOpacity>
          )}
        </View>

        {/* Inline reply input */}
        {isReplying && (
          <ReplyInput
            parentId={comment._id}
            currentUser={currentUser}
            onSubmit={(text) => { onReply(comment._id, text); setReplyingTo(null); }}
            onCancel={() => setReplyingTo(null)}
          />
        )}

        {/* Nested replies */}
        {comment.replies?.length > 0 && (
          <CollapsibleReplies
            replies={comment.replies}
            currentUser={currentUser}
            onLike={onLike}
            onDelete={onDelete}
          />
        )}
      </View>
    </View>
  );
});

// ── Collapsible replies (YouTube-style "View X replies") ─────────────────────
function CollapsibleReplies({ replies, currentUser, onLike, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ marginTop: 8 }}>
      <TouchableOpacity style={styles.viewRepliesBtn} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={C.crimson} />
        <Text style={styles.viewRepliesText}>
          {expanded ? 'Hide replies' : `View ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}`}
        </Text>
      </TouchableOpacity>
      {expanded && replies.map(r => (
        <CommentItem
          key={r._id}
          comment={r}
          depth={1}
          currentUser={currentUser}
          onLike={onLike}
          onDelete={onDelete}
          onReply={() => {}}
          replyingTo={null}
          setReplyingTo={() => {}}
        />
      ))}
    </View>
  );
}

// ── Inline reply input ────────────────────────────────────────────────────────
function ReplyInput({ parentId, currentUser, onSubmit, onCancel }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  return (
    <View style={styles.replyInputRow}>
      <Avatar uri={currentUser?.profile_image} email={currentUser?.email} size={26} border={currentUser?.profile_border} />
      <View style={styles.replyBox}>
        <TextInput
          ref={inputRef}
          style={styles.replyTextInput}
          placeholder="Add a reply..."
          placeholderTextColor={C.dimmer}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <View style={styles.replyBoxActions}>
          <TouchableOpacity onPress={onCancel} style={styles.replyActionBtn}>
            <Text style={{ color: C.dimmer, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => text.trim() && onSubmit(text.trim())}
            style={[styles.replyActionBtn, styles.replySubmitBtn, !text.trim() && { opacity: 0.4 }]}
            disabled={!text.trim()}
          >
            <Text style={{ color: C.white, fontSize: 12, fontWeight: '700' }}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Main Comment Input ────────────────────────────────────────────────────────
function NewCommentInput({ currentUser, onSubmit, isPosting }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }),
      Animated.timing(borderAnim, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.crimson] });

  return (
    <Animated.View style={[styles.newCommentCard, { borderColor }]}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Avatar uri={currentUser?.profile_image} email={currentUser?.email || 'guest'} size={36} border={currentUser?.profile_border} />
        <TextInput
          style={styles.newCommentInput}
          placeholder={currentUser ? 'Add a comment...' : 'Sign in to comment'}
          placeholderTextColor={C.dimmer}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          editable={!!currentUser && !isPosting}
          onFocus={() => setFocused(true)}
          onBlur={() => { if (!text) setFocused(false); }}
        />
      </View>

      {(focused || text.length > 0) && (
        <View style={styles.newCommentBtns}>
          <Text style={styles.charCount}>{text.length}/1000</Text>
          <TouchableOpacity onPress={() => { setText(''); setFocused(false); Keyboard.dismiss(); }} style={styles.cancelCommentBtn}>
            <Text style={{ color: C.dim, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitCommentBtn, (!text.trim() || isPosting) && { opacity: 0.4 }]}
            onPress={() => { if (text.trim()) { onSubmit(text.trim()); setText(''); setFocused(false); Keyboard.dismiss(); } }}
            disabled={!text.trim() || isPosting}
          >
            {isPosting
              ? <DotCircleLoader size={16} color="white" />
              : <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>Post</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

// ── Sort options ──────────────────────────────────────────────────────────────
const SORTS = [
  { key: 'newest', label: 'Newest', icon: 'time-outline' },
  { key: 'top',    label: 'Top',    icon: 'trending-up-outline' },
];

// ── Main CommentSection Component ────────────────────────────────────────────
export default function CommentSection({ animeId, episodeNum = null, onCommentAdded }) {
  const { user } = useAuth();
  const [comments,   setComments]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [isPosting,  setIsPosting]  = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [sort,       setSort]       = useState('newest');
  const [replyingTo, setReplyingTo] = useState(null);

  // Fetch + build tree
  const fetchComments = useCallback(async () => {
    try {
      const res = await CommentApi.getComments(animeId, episodeNum);
      if (!res.success) return;

      const flat = res.comments;
      const map = {};
      flat.forEach(c => { c.replies = []; map[c._id] = c; });
      const roots = [];
      flat.forEach(c => {
        if (c.parentId && map[c.parentId]) {
          map[c.parentId].replies.push(c);
        } else {
          roots.push(c);
        }
      });
      // Sort root comments
      const sorted = sort === 'top'
        ? roots.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
        : roots.sort((a, b) => new Date(b.ts) - new Date(a.ts));
      setComments(sorted);
      setTotalCount(flat.length);
    } catch (err) {
      console.log('fetchComments error:', err);
    } finally {
      setLoading(false);
    }
  }, [animeId, episodeNum, sort]);

  useEffect(() => { setLoading(true); fetchComments(); }, [fetchComments]);

  // Post new top-level comment
  const handlePost = useCallback(async (text) => {
    if (!user) { Alert.alert('Sign In Needed', 'Please log in to comment.'); return; }
    const displayName = user.isAdmin ? 'Animexis' : (user.name || null);
    if (!displayName) { Alert.alert('Profile Needed', 'Set a username in your profile first.'); return; }

    setIsPosting(true);
    try {
      const res = await CommentApi.createComment({
        animeId, episodeNum, text,
        parentId: null,
        userName: displayName,
        profileImage: user.profile_image,
        profileBorder: user.profile_border,
      });
      if (res.success) { fetchComments(); if (onCommentAdded) onCommentAdded(); }
    } catch { Alert.alert('Error', 'Could not post comment. Try again.'); }
    finally { setIsPosting(false); }
  }, [user, animeId, episodeNum, fetchComments, onCommentAdded]);

  // Post reply
  const handleReply = useCallback(async (parentId, text) => {
    if (!user) return;
    const displayName = user.isAdmin ? 'Animexis' : (user.name || null);
    if (!displayName) return;
    try {
      const res = await CommentApi.createComment({
        animeId, episodeNum, text,
        parentId,
        userName: displayName,
        profileImage: user.profile_image,
        profileBorder: user.profile_border,
      });
      if (res.success) fetchComments();
    } catch { Alert.alert('Error', 'Could not post reply.'); }
  }, [user, animeId, episodeNum, fetchComments]);

  // Like
  const handleLike = useCallback(async (commentId) => {
    if (!user) { Alert.alert('Sign In', 'Log in to like comments.'); return; }
    try {
      const res = await CommentApi.likeComment(commentId);
      if (res.success) {
        const update = (list) => list.map(c => {
          if (c._id === commentId) {
            const likes = res.liked
              ? [...(c.likes || []), user.email]
              : (c.likes || []).filter(e => e !== user.email);
            return { ...c, likes };
          }
          if (c.replies?.length) return { ...c, replies: update(c.replies) };
          return c;
        });
        setComments(prev => update(prev));
      }
    } catch {}
  }, [user]);

  // Delete
  const handleDelete = useCallback((commentId) => {
    Alert.alert('Delete Comment', 'This will permanently delete your comment and its replies.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await CommentApi.deleteComment(commentId);
          fetchComments();
        } catch { Alert.alert('Error', 'Could not delete comment.'); }
      }},
    ]);
  }, [fetchComments]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.sectionAccent} />
        <Text style={styles.headerTitle}>
          {episodeNum ? `Ep ${episodeNum} Discussion` : 'Comments'}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{totalCount}</Text>
        </View>

        {/* Sort pills */}
        <View style={styles.sortRow}>
          {SORTS.map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.sortPill, sort === s.key && styles.sortPillActive]}
              onPress={() => setSort(s.key)}
            >
              <Ionicons name={s.icon} size={11} color={sort === s.key ? C.crimson : C.dimmer} />
              <Text style={[styles.sortPillText, sort === s.key && { color: C.crimson }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* New comment input */}
      <NewCommentInput currentUser={user} onSubmit={handlePost} isPosting={isPosting} />

      {/* List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <DotCircleLoader size={18} color={C.crimson} />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="chatbubbles-outline" size={36} color={C.dimmer} />
          <Text style={styles.emptyTitle}>No comments yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to share your thoughts!</Text>
        </View>
      ) : (
        comments.map(item => (
          <CommentItem
            key={item._id}
            comment={item}
            currentUser={user}
            onReply={handleReply}
            onLike={handleLike}
            onDelete={handleDelete}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sectionAccent: { width: 3, height: 18, backgroundColor: C.crimson, borderRadius: 2 },
  headerTitle: { color: C.white, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.glass,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  countBadgeText: { color: C.dim, fontSize: 10, fontWeight: '700' },
  sortRow: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  sortPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: C.glass,
  },
  sortPillActive: { borderColor: C.crimsonBorder, backgroundColor: C.crimsonDim },
  sortPillText: { color: C.dimmer, fontSize: 11, fontWeight: '600' },

  loadingBox: { padding: 40, alignItems: 'center' },
  emptyBox:   { padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { color: C.dim, fontSize: 15, fontWeight: '700' },
  emptySubtitle: { color: C.dimmer, fontSize: 12, textAlign: 'center' },

  // New comment input
  newCommentCard: {
    borderWidth: 1, borderRadius: 16,
    backgroundColor: C.surface,
    padding: 12, marginBottom: 20, gap: 10,
  },
  newCommentInput: {
    flex: 1, color: C.white, fontSize: 14,
    minHeight: 40, textAlignVertical: 'top',
  },
  newCommentBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  charCount: { color: C.dimmer, fontSize: 11, marginRight: 'auto' },
  cancelCommentBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  submitCommentBtn: {
    backgroundColor: C.crimson,
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    minWidth: 60, alignItems: 'center',
  },

  // Comment block
  commentBlock: {
    flexDirection: 'row', gap: 10,
    marginBottom: 18,
  },
  replyBlock: {
    marginLeft: 10, marginTop: 10,
    paddingLeft: 12,
    borderLeftWidth: 1, borderLeftColor: C.glass,
  },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  commentAuthor: { color: C.white, fontSize: 13, fontWeight: '700' },
  commentTime: { color: C.dimmer, fontSize: 11 },
  commentBody: { color: '#c8c8dc', fontSize: 14, lineHeight: 21, marginBottom: 8 },
  modPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.crimsonDim, borderWidth: 1, borderColor: C.crimsonBorder,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  modPillText: { color: C.crimson, fontSize: 8, fontWeight: '800' },

  commentActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionPillText: { color: C.dim, fontSize: 12, fontWeight: '600' },

  // Replies
  viewRepliesBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  viewRepliesText: { color: C.crimson, fontSize: 12, fontWeight: '700' },

  // Reply input
  replyInputRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  replyBox: {
    flex: 1, backgroundColor: C.surfaceHigh,
    borderRadius: 12, borderWidth: 1, borderColor: C.glass, padding: 10,
  },
  replyTextInput: { color: C.white, fontSize: 13, minHeight: 36, textAlignVertical: 'top' },
  replyBoxActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  replyActionBtn: { paddingHorizontal: 12, paddingVertical: 5 },
  replySubmitBtn: { backgroundColor: C.crimson, borderRadius: 16 },
});
