import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C, gradients, radius, shadow, space, type, ui } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ScreenShell({ children, style, contentStyle, gradient = true }) {
  return (
    <View style={[ui.screen, style]}>
      {gradient && <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />}
      <View style={[styles.screenContent, contentStyle]}>{children}</View>
    </View>
  );
}

export function GlassPanel({ children, style, intensity = 28, tint = "dark" }) {
  return (
    <BlurView intensity={intensity} tint={tint} style={[styles.glassPanel, style]}>
      {children}
    </BlurView>
  );
}

export function SurfaceCard({ children, style, animated = true }) {
  const content = <View style={[styles.surfaceCard, style]}>{children}</View>;

  if (!animated) return content;

  return (
    <Animated.View entering={FadeIn.duration(260)}>
      {content}
    </Animated.View>
  );
}

export function CrimsonButton({
  children,
  icon,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
  onPress,
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isGhost = variant === "ghost";
  const isSubtle = variant === "subtle";

  return (
    <AnimatedPressable
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      style={[
        styles.button,
        isGhost && styles.buttonGhost,
        isSubtle && styles.buttonSubtle,
        (disabled || loading) && styles.buttonDisabled,
        animatedStyle,
        style,
      ]}
    >
      {isGhost || isSubtle ? (
        <ButtonContent icon={icon} loading={loading} textStyle={textStyle}>
          {children}
        </ButtonContent>
      ) : (
        <LinearGradient
          colors={gradients.crimsonButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}
        >
          <ButtonContent icon={icon} loading={loading} textStyle={textStyle}>
            {children}
          </ButtonContent>
        </LinearGradient>
      )}
    </AnimatedPressable>
  );
}

function ButtonContent({ children, icon, loading, textStyle }) {
  return (
    <View style={styles.buttonContent}>
      {loading ? (
        <ActivityIndicator size="small" color={C.white} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={C.white} />}
          <Text style={[styles.buttonText, textStyle]} numberOfLines={1}>
            {children}
          </Text>
        </>
      )}
    </View>
  );
}

export function IconChip({ icon, label, active = false, style, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.iconChip, active && styles.iconChipActive, style]}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? C.white : C.dim} />}
      {label && (
        <Text style={[styles.iconChipText, active && styles.iconChipTextActive]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function SectionHeader({ eyebrow, title, actionLabel, onAction, style }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleWrap}>
        {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.sectionTitle} numberOfLines={2}>{title}</Text>
      </View>
      {actionLabel && (
        <Pressable onPress={onAction} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={C.crimson} />
        </Pressable>
      )}
    </View>
  );
}

export function PosterImage({
  uri,
  style,
  contentFit = "cover",
  transition = 200,
  fallbackText = "ANIMEXIS",
}) {
  const source = useMemo(
    () => (uri ? { uri } : { uri: `https://placehold.co/500x720/121212/DC143C?text=${encodeURIComponent(fallbackText)}` }),
    [fallbackText, uri]
  );

  return (
    <Image
      source={source}
      style={[styles.posterImage, style]}
      contentFit={contentFit}
      transition={transition}
    />
  );
}

export function EmptyState({ icon = "film-outline", title, text, actionLabel, onAction }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={C.crimson} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text && <Text style={styles.emptyText}>{text}</Text>}
      {actionLabel && (
        <CrimsonButton icon="compass-outline" onPress={onAction} style={styles.emptyButton}>
          {actionLabel}
        </CrimsonButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  glassPanel: {
    ...ui.glassPanel,
  },
  surfaceCard: {
    ...ui.card,
    ...shadow.soft,
    padding: space.lg,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadow.crimson,
  },
  buttonGradient: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  buttonText: {
    ...type.bodyStrong,
    fontSize: 14,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    backgroundColor: "rgba(220,20,60,0.08)",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonSubtle: {
    borderWidth: 1,
    borderColor: C.glass,
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  iconChip: {
    minHeight: 34,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: C.glass,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  iconChipActive: {
    borderColor: C.crimsonBorder,
    backgroundColor: C.crimsonTint,
  },
  iconChipText: {
    ...type.caption,
    fontWeight: "700",
  },
  iconChipTextActive: {
    color: C.white,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.md,
    marginBottom: space.md,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  eyebrow: {
    ...type.overline,
    marginBottom: 4,
  },
  sectionTitle: {
    ...type.h2,
  },
  sectionAction: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: space.sm,
  },
  sectionActionText: {
    ...type.caption,
    color: C.crimson,
    fontWeight: "800",
  },
  posterImage: {
    backgroundColor: C.surfaceHigh,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    backgroundColor: C.crimsonDim,
    marginBottom: space.lg,
  },
  emptyTitle: {
    ...type.h3,
    textAlign: "center",
    marginBottom: space.sm,
  },
  emptyText: {
    ...type.body,
    color: C.dim,
    textAlign: "center",
    maxWidth: 360,
  },
  emptyButton: {
    marginTop: space.lg,
    minWidth: 160,
  },
});
