import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";

const SHIMMER_COLORS = [
  "rgba(255,255,255,0.00)",
  "rgba(255,255,255,0.08)",
  "rgba(255,255,255,0.18)",
  "rgba(255,255,255,0.08)",
  "rgba(255,255,255,0.00)",
];
const SHIMMER_LOCATIONS = [0, 0.2, 0.5, 0.8, 1];

const ShimmerCard = ({ cardWidth, cardHeight, shimmerX }) => {
  const translateX = shimmerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-cardWidth, cardWidth * 2],
  });
  const shimmerOpacity = shimmerX.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.18, 0.55, 0.18],
  });

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <View style={[styles.imagePlaceholder, { width: cardWidth, height: cardHeight }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: shimmerOpacity,
              transform: [{ translateX }, { skewX: "-12deg" }],
            },
          ]}
        >
          <LinearGradient
            colors={SHIMMER_COLORS}
            locations={SHIMMER_LOCATIONS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <View style={[styles.textLine, { width: cardWidth * 0.85, marginTop: 10 }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: shimmerOpacity,
              transform: [{ translateX }, { skewX: "-12deg" }],
            },
          ]}
        >
          <LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <View style={[styles.textLine, { width: cardWidth * 0.55, marginTop: 6, height: 10 }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: shimmerOpacity,
              transform: [{ translateX }, { skewX: "-12deg" }],
            },
          ]}
        >
          <LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </View>
  );
};

export default function SkeletonGrid({ count = 12, cardWidth, cardHeight }) {
  const { width } = useWindowDimensions();
  const shimmerX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Calculate default card dimensions if not provided (matching common grid pattern)
  const finalCardWidth = cardWidth || (width >= 768 ? (width - 60) / 4 : (width - 40) / 2);
  const finalCardHeight = cardHeight || finalCardWidth * 1.4;

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard 
          key={i} 
          cardWidth={finalCardWidth} 
          cardHeight={finalCardHeight} 
          shimmerX={shimmerX} 
        />
      ))}
    </View>
  );
}

const ShimmerList = ({ shimmerX, width }) => {
  const translateX = shimmerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width * 1.5],
  });
  const shimmerOpacity = shimmerX.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.18, 0.55, 0.18],
  });

  return (
    <View style={styles.listCard}>
      <View style={styles.listImagePlaceholder}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: shimmerOpacity, transform: [{ translateX }, { skewX: "-12deg" }] }]}>
          <LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <View style={styles.listInfo}>
        <View style={[styles.textLine, { width: '70%', height: 16 }]}><Animated.View style={[StyleSheet.absoluteFill, { opacity: shimmerOpacity, transform: [{ translateX }, { skewX: "-12deg" }] }]}><LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View></View>
        <View style={[styles.textLine, { width: '30%', height: 12, marginTop: 10 }]}><Animated.View style={[StyleSheet.absoluteFill, { opacity: shimmerOpacity, transform: [{ translateX }, { skewX: "-12deg" }] }]}><LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View></View>
      </View>
    </View>
  );
};

export function SkeletonList({ count = 8 }) {
  const { width } = useWindowDimensions();
  const shimmerX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(shimmerX, { toValue: 1, duration: 1800, useNativeDriver: true })).start();
  }, []);

  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => <ShimmerList key={i} shimmerX={shimmerX} width={width} />)}
    </View>
  );
}

export function SkeletonProfile() {
  const { width } = useWindowDimensions();
  const shimmerX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(shimmerX, { toValue: 1, duration: 1800, useNativeDriver: true })).start();
  }, []);

  const translateX = shimmerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width * 1.5],
  });
  const shimmerOpacity = shimmerX.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.18, 0.55, 0.18],
  });

  return (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <View style={[styles.avatarPlaceholder, { width: 80, height: 80, borderRadius: 40 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: shimmerOpacity, transform: [{ translateX }, { skewX: "-12deg" }] }]}><LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>
      </View>
      <View style={[styles.textLine, { width: 120, height: 18, marginTop: 15 }]}><Animated.View style={[StyleSheet.absoluteFill, { opacity: shimmerOpacity, transform: [{ translateX }, { skewX: "-12deg" }] }]}><LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View></View>
      <View style={[styles.textLine, { width: 80, height: 12, marginTop: 10 }]}><Animated.View style={[StyleSheet.absoluteFill, { opacity: shimmerOpacity, transform: [{ translateX }, { skewX: "-12deg" }] }]}><LinearGradient colors={SHIMMER_COLORS} locations={SHIMMER_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View></View>
      <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 20 }} />
      <SkeletonList count={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
    gap: 12,
    justifyContent: "center",
  },
  card: {
    marginBottom: 20,
  },
  imagePlaceholder: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    overflow: "hidden",
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  textLine: {
    height: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 4,
    overflow: "hidden",
    position: 'relative'
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  listImagePlaceholder: {
    width: 44,
    height: 64,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden'
  },
  listInfo: {
    flex: 1,
    marginLeft: 12
  }
});
