import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet } from "react-native";
import { C } from "../theme";

export default function DotCircleLoader({
  size = 44,
  dots = 8,
  color = C.crimson,
  durationMs = 900,
}) {
  const rotate = useRef(new Animated.Value(0)).current;
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";
    let cancelled = false;

    const startSpin = () => {
      if (cancelled) return;
      rotate.setValue(0);
      Animated.timing(rotate, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver,
      }).start(({ finished }) => {
        if (finished && !cancelled) startSpin();
      });
    };

    const startPulse = () => {
      if (cancelled) return;
      phase.setValue(0);
      Animated.timing(phase, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver,
      }).start(({ finished }) => {
        if (finished && !cancelled) startPulse();
      });
    };

    startSpin();
    startPulse();

    return () => {
      cancelled = true;
      rotate.stopAnimation();
      phase.stopAnimation();
    };
  }, [durationMs, rotate, phase]);

  const dotAngles = useMemo(() => {
    const out = [];
    for (let i = 0; i < dots; i += 1) out.push((i / dots) * Math.PI * 2);
    return out;
  }, [dots]);

  const r = size / 2;
  const dotSize = Math.max(3, Math.round(size * 0.12));
  const ringRadius = r - dotSize * 0.9;

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, transform: [{ rotate: rotation }] }]}>
      {dotAngles.map((a, i) => {
        const x = r + ringRadius * Math.cos(a) - dotSize / 2;
        const y = r + ringRadius * Math.sin(a) - dotSize / 2;
        const t = i / Math.max(1, dots - 1);

        const opacity = phase.interpolate({
          inputRange: [0, 1],
          outputRange: [0.25 + 0.55 * t, 0.25],
        });
        const scale = phase.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7 + 0.45 * t, 0.65],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: color,
                left: x,
                top: y,
                opacity,
                transform: [{ scale }],
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  dot: { position: "absolute" },
});
