// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

const C = {
  bg: "#080809",
  panel: "#101014",
  panelHigh: "#17171d",
  crimson: "#DC143C",
  white: "#F2EFF8",
  dim: "#9a9aad",
  dimmer: "#646476",
  border: "rgba(255,255,255,0.08)",
};

const STARTER_MESSAGES = [
  {
    role: "assistant",
    content: "Hi, I am Animexis Assistant. Ask me about the app, anime discovery, subscriptions, downloads, or playback.",
  },
];

const FAB_SIZE = 58;
const POSITION_KEY = "animexis_ai_bot_position";
const QUICK_PROMPTS = [
  "How do downloads work?",
  "Why will video not play?",
  "How do I upgrade?",
  "Recommend an anime",
];
const GREETING_TITLE = "Need help?";
const GREETING_BODY = "Hi, I am your Animexis AI assistant.";
const GREETING_TIMING = {
  titleType: 105,
  bodyType: 62,
  gapAfterTitle: 420,
  hold: 3600,
  bodyErase: 46,
  gapBeforeTitleErase: 300,
  titleErase: 70,
  hideDelay: 420,
  repeatEvery: 40000,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function GreetingBubble({ sideStyle, verticalStyle, onPress, onFinish }) {
  const [titleText, setTitleText] = useState("");
  const [bodyText, setBodyText] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timers = [];
    const schedule = (fn, delay) => {
      const id = setTimeout(() => {
        if (!cancelled) fn();
      }, delay);
      timers.push(id);
    };

    [...GREETING_TITLE].forEach((_, index) => {
      schedule(() => setTitleText(GREETING_TITLE.slice(0, index + 1)), GREETING_TIMING.titleType * (index + 1));
    });

    const bodyStart = GREETING_TIMING.titleType * GREETING_TITLE.length + GREETING_TIMING.gapAfterTitle;
    [...GREETING_BODY].forEach((_, index) => {
      schedule(() => setBodyText(GREETING_BODY.slice(0, index + 1)), bodyStart + GREETING_TIMING.bodyType * (index + 1));
    });

    const eraseStart = bodyStart + GREETING_TIMING.bodyType * GREETING_BODY.length + GREETING_TIMING.hold;
    [...GREETING_BODY].forEach((_, index) => {
      schedule(() => setBodyText(GREETING_BODY.slice(0, GREETING_BODY.length - index - 1)), eraseStart + GREETING_TIMING.bodyErase * (index + 1));
    });

    const titleEraseStart = eraseStart + GREETING_TIMING.bodyErase * GREETING_BODY.length + GREETING_TIMING.gapBeforeTitleErase;
    [...GREETING_TITLE].forEach((_, index) => {
      schedule(() => setTitleText(GREETING_TITLE.slice(0, GREETING_TITLE.length - index - 1)), titleEraseStart + GREETING_TIMING.titleErase * (index + 1));
    });

    schedule(onFinish, titleEraseStart + GREETING_TIMING.titleErase * GREETING_TITLE.length + GREETING_TIMING.hideDelay);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <Pressable onPress={onPress} style={[styles.greetingBubble, sideStyle, verticalStyle]}>
      <Text style={styles.greetingTitle}>
        {titleText}
        {titleText.length < GREETING_TITLE.length ? <Text style={styles.cursor}>|</Text> : null}
      </Text>
      <Text style={styles.greetingText}>
        {bodyText}
        {titleText.length === GREETING_TITLE.length && bodyText.length < GREETING_BODY.length ? (
          <Text style={styles.cursor}>|</Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

export default function FloatingAIBot({ getCurrentRouteName }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef(null);
  const dragAnim = useRef(new Animated.ValueXY({
    x: width - FAB_SIZE - 18,
    y: height - FAB_SIZE - Math.max(insets.bottom, 12) - 82,
  })).current;
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedRecentlyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(STARTER_MESSAGES);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [fabPosition, setFabPosition] = useState({
    x: width - FAB_SIZE - 18,
    y: height - FAB_SIZE - Math.max(insets.bottom, 12) - 82,
  });

  const messageStorageKey = user?.email ? `animexis_ai_bot_messages:${user.email}` : null;
  const greetingSideStyle = fabPosition.x > width / 2 ? { right: 0 } : { left: 0 };
  const greetingVerticalStyle = fabPosition.y < 170 ? { top: 68, bottom: undefined } : { bottom: 68 };

  const clampPosition = (position) => ({
    x: clamp(position.x, 10, Math.max(10, width - FAB_SIZE - 10)),
    y: clamp(position.y, Math.max(insets.top, 10), Math.max(10, height - FAB_SIZE - Math.max(insets.bottom, 10))),
  });

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(POSITION_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw);
        if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
          const next = clampPosition(saved);
          dragAnim.setValue(next);
          setFabPosition(next);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [width, height, insets.top, insets.bottom]);

  useEffect(() => {
    let active = true;
    setHistoryLoaded(false);

    if (!messageStorageKey) {
      setMessages(STARTER_MESSAGES);
      setHistoryLoaded(true);
      return () => {
        active = false;
      };
    }

    AsyncStorage.getItem(messageStorageKey)
      .then((raw) => {
        if (!active) return;
        const saved = raw ? JSON.parse(raw) : null;
        if (Array.isArray(saved) && saved.length) {
          setMessages(saved);
        } else {
          setMessages(STARTER_MESSAGES);
        }
      })
      .catch(() => {
        if (active) setMessages(STARTER_MESSAGES);
      })
      .finally(() => {
        if (active) setHistoryLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [messageStorageKey]);

  useEffect(() => {
    if (!messageStorageKey || !historyLoaded) return;
    AsyncStorage.setItem(messageStorageKey, JSON.stringify(messages.slice(-24))).catch(() => {});
  }, [messageStorageKey, historyLoaded, messages]);

  useEffect(() => {
    const next = clampPosition(fabPosition);
    dragAnim.setValue(next);
    setFabPosition(next);
  }, [width, height, insets.top, insets.bottom]);

  useEffect(() => {
    if (!user || open) return undefined;
    const show = () => setShowGreeting(true);
    const firstTimer = setTimeout(show, 900);
    const interval = setInterval(show, GREETING_TIMING.repeatEvery);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [user, open]);

  // The complex typing animation state is now isolated in the GreetingBubble component

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStartRef.current = fabPosition;
        draggedRecentlyRef.current = false;
        setShowGreeting(false);
      },
      onPanResponderMove: (_, gesture) => {
        draggedRecentlyRef.current = true;
        dragAnim.setValue(clampPosition({
          x: dragStartRef.current.x + gesture.dx,
          y: dragStartRef.current.y + gesture.dy,
        }));
      },
      onPanResponderRelease: (_, gesture) => {
        const next = clampPosition({
          x: dragStartRef.current.x + gesture.dx,
          y: dragStartRef.current.y + gesture.dy,
        });
        dragAnim.setValue(next);
        setFabPosition(next);
        AsyncStorage.setItem(POSITION_KEY, JSON.stringify(next)).catch(() => {});
        setTimeout(() => {
          draggedRecentlyRef.current = false;
        }, 160);
      },
      onPanResponderTerminate: () => {
        dragAnim.setValue(dragStartRef.current);
        setTimeout(() => {
          draggedRecentlyRef.current = false;
        }, 120);
      },
    }),
    [fabPosition, width, height, insets.top, insets.bottom]
  );

  if (!user || user.account_status === "pending") return null;

  const sendQuestion = async (presetQuestion) => {
    const question = (presetQuestion || input).trim();
    if (!question || loading) return;

    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    if (!presetQuestion) setInput("");
    setLoading(true);

    try {
      const res = await API.post("/api/ai/ask", {
        question,
        history: messages.slice(-8),
        screen: typeof getCurrentRouteName === "function" ? getCurrentRouteName() : null,
        userContext: {
          subscription: user.subscription || "free",
          account_status: user.account_status || "active",
          isAdmin: !!user.isAdmin,
        },
      });

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: res.data?.answer || "I could not answer that right now.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error.response?.data?.message || "AI assistant is unavailable right now.",
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const clearChat = () => {
    setMessages(STARTER_MESSAGES);
    setInput("");
    if (messageStorageKey) AsyncStorage.removeItem(messageStorageKey).catch(() => {});
  };

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.fabWrap, { transform: dragAnim.getTranslateTransform() }]}
      >
        {showGreeting && !open && (
          <GreetingBubble
            sideStyle={greetingSideStyle}
            verticalStyle={greetingVerticalStyle}
            onFinish={() => setShowGreeting(false)}
            onPress={() => {
              setShowGreeting(false);
              setOpen(true);
            }}
          />
        )}
        <Pressable
          onPress={() => {
            setShowGreeting(false);
            setOpen(true);
          }}
          style={styles.fab}
        >
          <LinearGradient
            colors={["#ff315d", C.crimson, "#8f1230"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <View style={styles.fabRing}>
              <Ionicons name="chatbubble-ellipses" size={24} color={C.white} />
            </View>
            <View style={styles.fabBadge} />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <LinearGradient colors={["#ff315d", C.crimson]} style={styles.botIcon}>
                  <Ionicons name="sparkles" size={18} color={C.white} />
                </LinearGradient>
                <View>
                  <Text style={styles.title}>Animexis AI</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, loading && styles.statusDotBusy]} />
                    <Text style={styles.status}>{loading ? "Thinking..." : "Live assistant"}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={clearChat} style={styles.iconButton}>
                  <Ionicons name="refresh" size={18} color={C.dim} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setOpen(false)} style={styles.iconButton}>
                  <Ionicons name="close" size={20} color={C.dim} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickPrompts}
            >
              {QUICK_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  onPress={() => sendQuestion(prompt)}
                  disabled={loading}
                  style={[styles.quickPrompt, loading && styles.quickPromptDisabled]}
                >
                  <Ionicons name="flash-outline" size={13} color={C.white} />
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <View
                    key={`${message.role}-${index}`}
                    style={[styles.messageRow, isUser && styles.messageRowUser]}
                  >
                    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                      <Text style={isUser ? styles.userText : styles.assistantText}>
                        {message.content}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {loading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={C.crimson} />
                  <Text style={styles.loadingText}>Writing answer</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask a question..."
                placeholderTextColor={C.dimmer}
                style={styles.input}
                multiline
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={Platform.OS === "web" ? () => sendQuestion() : undefined}
              />
              <TouchableOpacity
                onPress={() => sendQuestion()}
                disabled={!input.trim() || loading}
                style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
              >
                <Ionicons name="send" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: "absolute",
    zIndex: 100,
  },
  greetingBubble: {
    position: "absolute",
    bottom: 68,
    width: 218,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "rgba(16,16,20,0.96)",
    borderWidth: 1,
    borderColor: "rgba(220,20,60,0.28)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  cursor: { color: C.crimson, fontWeight: "900" },
  greetingTitle: { color: C.white, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  greetingText: { color: C.dim, fontSize: 12, lineHeight: 17 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.crimson,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  fabRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  fabBadge: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: C.white,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 480,
    maxHeight: "82%",
    backgroundColor: C.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  header: {
    height: 68,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.panelHigh,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  botIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: C.white, fontSize: 16, fontWeight: "800" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },
  statusDotBusy: { backgroundColor: "#f59e0b" },
  status: { color: C.dim, fontSize: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  quickPrompts: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  quickPrompt: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "rgba(220,20,60,0.14)",
    borderWidth: 1,
    borderColor: "rgba(220,20,60,0.25)",
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
  },
  quickPromptDisabled: { opacity: 0.55 },
  quickPromptText: { color: C.white, fontSize: 12, fontWeight: "700" },
  messages: { flexGrow: 0 },
  messagesContent: { padding: 16, gap: 10 },
  messageRow: { flexDirection: "row", justifyContent: "flex-start" },
  messageRowUser: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "84%",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  assistantBubble: {
    backgroundColor: C.panelHigh,
    borderWidth: 1,
    borderColor: C.border,
  },
  userBubble: { backgroundColor: C.crimson },
  assistantText: { color: C.white, fontSize: 14, lineHeight: 20 },
  userText: { color: C.white, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  loadingText: { color: C.dim, fontSize: 12 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    color: C.white,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: C.panelHigh,
    borderWidth: 1,
    borderColor: C.border,
    outlineStyle: "none",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.crimson,
  },
  sendButtonDisabled: { opacity: 0.45 },
});
