import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { color, radius } from "@/lib/theme";

type BoneProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
  circle?: boolean;
};

/** Single pulsing gray placeholder block. */
export function SkeletonBone({
  width = "100%",
  height = 14,
  style,
  circle = false,
}: BoneProps) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.bone,
        {
          width,
          height,
          opacity: pulse,
          borderRadius: circle ? height / 2 : radius.md,
        },
        style,
      ]}
    />
  );
}

/** Home favorites skeleton matching icon + title card layout. */
export function HomeFavoritesSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1].map((section) => (
        <View key={section}>
          <View style={styles.mealRow}>
            <SkeletonBone width={14} height={14} circle />
            <SkeletonBone width={72} height={12} style={styles.mealLabel} />
            <View style={styles.mealLine} />
          </View>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.card}>
              <SkeletonBone width={44} height={44} circle />
              <View style={styles.copy}>
                <SkeletonBone
                  width={row === 0 ? "78%" : row === 1 ? "68%" : "58%"}
                  height={15}
                />
                <SkeletonBone
                  width={row === 0 ? "42%" : row === 1 ? "50%" : "36%"}
                  height={12}
                  style={styles.hallBone}
                />
              </View>
              <SkeletonBone width={12} height={18} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: color.hairline,
  },
  list: {
    flex: 1,
    alignSelf: "stretch",
    width: "100%",
    paddingBottom: 8,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  mealLabel: {
    borderRadius: 4,
  },
  mealLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hairline,
  },
  card: {
    alignSelf: "stretch",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: color.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  copy: {
    flex: 1,
    gap: 8,
  },
  hallBone: {
    borderRadius: 4,
  },
});
