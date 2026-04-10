import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  interpolate,
  Easing,
  withSequence,
  withDelay
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * PremiumBorder — High-performance animated border for user avatars.
 * Styles: 'gold', 'neon', 'cosmic'
 */
const PremiumBorder = ({ children, borderStyle, size = 50, borderWidth = 3 }) => {
  if (!borderStyle) return <>{children}</>;

  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    // Continuous rotation for Gradient
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
    
    // Subtle pulse
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [borderStyle]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: pulse.value }
      ],
    };
  });

  const getColors = () => {
    switch (borderStyle) {
      case 'gold':   return ['#FFD700', '#FFA500', '#FF8C00', '#FFD700'];
      case 'neon':   return ['#00f2ff', '#0062ff', '#7000ff', '#00f2ff'];
      case 'cosmic': return ['#ff00cc', '#3333ff', '#00cccc', '#ff00cc'];
      default:       return ['#444', '#222'];
    }
  };

  const containerSize = size + (borderWidth * 2) + 4; // Add padding for the border
  const radius = containerSize / 2;

  return (
    <View style={[styles.outer, { width: containerSize, height: containerSize, borderRadius: radius }]}>
      <Animated.View style={[styles.animContainer, animatedStyle, { width: containerSize * 1.4, height: containerSize * 1.4 }]}>
        <LinearGradient
          colors={getColors()}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      {/* Inner Mask to keep the avatar clean */}
      <View style={[styles.inner, { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor: '#000' 
      }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 999,
  },
  animContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    zIndex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default PremiumBorder;
