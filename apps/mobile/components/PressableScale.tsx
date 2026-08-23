import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { motion } from "@/lib/theme";

type Props = Omit<PressableProps, "style" | "children"> & {
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

function springTo(value: Animated.Value, toValue: number) {
  Animated.spring(value, {
    toValue,
    friction: motion.spring.friction,
    tension: motion.spring.tension,
    useNativeDriver: motion.spring.useNativeDriver,
  }).start();
}

/** Shared press / selected spring. Every tappable surface uses this. */
export function PressableScale({
  selected = false,
  disabled,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(
    new Animated.Value(selected ? motion.selectedScale : 1),
  ).current;

  useEffect(() => {
    springTo(scale, selected ? motion.selectedScale : 1);
  }, [selected, scale]);

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(event) => {
        springTo(scale, motion.pressScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        springTo(scale, selected ? motion.selectedScale : 1);
        onPressOut?.(event);
      }}
      style={{ opacity: disabled ? motion.disabledOpacity : 1 }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
