import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import DotCircleLoader from './DotCircleLoader';

export default function ReportModal({ visible, onClose }) {
  const { user } = useAuth();
  const [type, setType] = useState('bug'); // 'bug' | 'support'
  const [email, setEmail] = useState(user?.email || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      if (user?.email) setEmail(user.email);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, user]);

  const handleSubmit = async () => {
    if (!email.trim() || !title.trim() || !description.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields so we can help you.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/reports/submit', {
        type,
        title: title.trim(),
        description: description.trim(),
        email: email.trim().toLowerCase(),
        userId: user?.id || null,
      });

      if (res.data.success) {
        Alert.alert('Sent!', res.data.message);
        setTitle('');
        setDescription('');
        onClose();
      } else {
        Alert.alert('Error', res.data.message || 'Failed to send report.');
      }
    } catch (err) {
      console.error('Report submission error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible && fadeAnim._value === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.keyboardView}
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name={type === 'bug' ? "bug" : "help-buoy"} size={18} color={C.crimson} />
              </View>
              <Text style={styles.title}>Submit a Report</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={C.dim} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Category</Text>
            <View style={styles.typeRow}>
              {[
                { id: 'bug', label: 'Bug Report', icon: 'bug-outline' },
                { id: 'support', label: 'General Support', icon: 'chatbox-ellipses-outline' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeBtn, type === t.id && styles.typeBtnActive]}
                  onPress={() => setType(t.id)}
                >
                  <Ionicons 
                    name={t.icon} 
                    size={16} 
                    color={type === t.id ? C.white : C.dim} 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={[styles.typeText, type === t.id && styles.typeTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Your Email</Text>
            <TextInput
              style={styles.input}
              placeholder="How can we reach you?"
              placeholderTextColor={C.dimmer}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              outlineStyle="none"
              editable={!user} // If logged in, email is fixed
            />

            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="Brief summary of the issue"
              placeholderTextColor={C.dimmer}
              value={title}
              onChangeText={setTitle}
              outlineStyle="none"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us what happened..."
              placeholderTextColor={C.dimmer}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              outlineStyle="none"
            />

            <TouchableOpacity 
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <DotCircleLoader size={18} color="white" />
              ) : (
                <>
                  <Text style={styles.submitText}>Send Report</Text>
                  <Ionicons name="send" size={14} color="white" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              {type === 'support' 
                ? "General support requests will be emailed directly to our admin. Typical response time is 24-48h."
                : "Bug reports help us improve the app. We may not reply to every report, but we read them all!"}
            </Text>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: C.border,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 8
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: C.crimsonDim,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.crimsonBorder,
  },
  title: { color: C.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  closeBtn: { padding: 4 },
  
  content: { padding: 20 },
  label: { color: C.dim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 16 },
  
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 14, backgroundColor: C.surfaceHigh,
    borderWidth: 1, borderColor: C.border,
  },
  typeBtnActive: { backgroundColor: C.crimsonDim, borderColor: C.crimsonBorder },
  typeText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  typeTextActive: { color: C.white, fontWeight: '700' },

  input: {
    backgroundColor: C.surfaceHigh, borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 14, color: C.white, fontSize: 14, borderWidth: 1, borderColor: C.border,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  submitBtn: {
    backgroundColor: C.crimson, borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 24, shadowColor: C.crimson, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: C.white, fontSize: 15, fontWeight: '700' },

  footerNote: { color: C.dimmer, fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});
