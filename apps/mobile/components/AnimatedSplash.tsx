import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";

const ICON_SIZE = 168;
const BERKELEY_DEEP = "#003262";
const BERKELEY_MID = "#1B4F8A";
const BERKELEY_GOLD = "#FDB515";
/** Always hold at least this long so auth-speed / Strict Mode can't skip the intro. */
const MIN_INTRO_MS = 2800;

const timesNewRoman = Platform.select({
  ios: "Times New Roman",
  web: '"Times New Roman", Times, serif',
  default: "serif",
});

type Props = {
  canExit: boolean;
  onExitComplete: () => void;
};

/**
 * Brand intro: blue stripe gradient → cookie pop → bite → gold CALBITE + tagline.
 */
export function AnimatedSplash({ canExit, onExitComplete }: Props) {
  const iconScale = useRef(new Animated.Value(0.82)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const wholeOpacity = useRef(new Animated.Value(1)).current;
  const bittenOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(14)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const introReady = useRef(false);
  const exiting = useRef(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    const enter = Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.sequence([
        Animated.spring(iconScale, {
          toValue: 1.06,
          friction: 10,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 12,
          tension: 140,
          useNativeDriver: true,
        }),
      ]),
    ]);

    const bite = Animated.sequence([
      Animated.delay(750),
      Animated.parallel([
        Animated.timing(wholeOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(bittenOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(iconScale, {
            toValue: 1.05,
            duration: 120,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(iconScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
      ]),
    ]);

    const titleIn = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 480,
        delay: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(titleTranslate, {
        toValue: 0,
        duration: 480,
        delay: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]);

    const tagIn = Animated.sequence([
      Animated.delay(900),
      Animated.timing(tagOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]);

    const anim = Animated.parallel([enter, bite, titleIn, tagIn]);
    anim.start();

    // Clock-based gate — don't trust Animated "finished" (Strict Mode / web cancel it).
    const hold = setTimeout(() => {
      introReady.current = true;
    }, MIN_INTRO_MS);

    return () => {
      anim.stop();
      clearTimeout(hold);
    };
  }, [
    bittenOpacity,
    iconOpacity,
    iconScale,
    tagOpacity,
    titleOpacity,
    titleTranslate,
    wholeOpacity,
  ]);

  useEffect(() => {
    if (!canExit || exiting.current) return;

    const tryExit = () => {
      if (!introReady.current || exiting.current) return;
      exiting.current = true;
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }).start(() => {
        onExitComplete();
      });
    };

    if (introReady.current) {
      tryExit();
      return;
    }

    const id = setInterval(() => {
      if (introReady.current) {
        clearInterval(id);
        tryExit();
      }
    }, 50);

    return () => clearInterval(id);
  }, [canExit, onExitComplete, screenOpacity]);

  const { width, height } = Dimensions.get("window");
  const stripeW = Math.max(width, height) * 1.6;

  return (
    <Animated.View style={[styles.screen, { opacity: screenOpacity }]}>
      <LinearGradient
        colors={[BERKELEY_DEEP, BERKELEY_MID, "#3D7AB5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* CapWords-style soft diagonal bands */}
      <View pointerEvents="none" style={styles.stripeLayer}>
        {[0.12, 0.28, 0.44, 0.6, 0.76].map((offset, i) => (
          <View
            key={i}
            style={[
              styles.stripe,
              {
                width: stripeW,
                left: -width * 0.3,
                top: height * offset - 40,
                opacity: i % 2 === 0 ? 0.1 : 0.06,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.iconWrap,
            {
              opacity: iconOpacity,
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          <Animated.View style={[styles.frame, { opacity: wholeOpacity }]}>
            <Image
              source={require("../assets/calbite-cookie-whole.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Chocolate chip cookie"
            />
          </Animated.View>
          <Animated.View
            style={[styles.frame, styles.frameOverlay, { opacity: bittenOpacity }]}
          >
            <Image
              source={require("../assets/calbite-cookie-bitten.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Cookie with a bite taken"
            />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslate }],
            alignItems: "center",
          }}
        >
          <Text style={styles.title}>CALBITE</Text>
          <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
            Good food. Less searching.
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BERKELEY_DEEP,
    justifyContent: "center",
    alignItems: "center",
  },
  stripeLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  stripe: {
    position: "absolute",
    height: 72,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "-28deg" }],
    borderRadius: 4,
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 32,
    zIndex: 2,
    elevation: 4,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    marginBottom: 22,
  },
  frame: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  logo: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  title: {
    fontFamily: timesNewRoman,
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: 3,
    color: BERKELEY_GOLD,
    marginBottom: 10,
    textAlign: "center",
    textShadowColor: "rgba(0, 50, 98, 0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontFamily: timesNewRoman,
    fontSize: 18,
    fontWeight: "400",
    fontStyle: "italic",
    color: BERKELEY_GOLD,
    letterSpacing: 0.4,
    textAlign: "center",
    textShadowColor: "rgba(0, 50, 98, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
