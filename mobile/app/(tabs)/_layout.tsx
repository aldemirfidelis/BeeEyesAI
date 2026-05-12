import { Tabs } from "expo-router";
import { View, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, getThemeColors } from "../../lib/theme";
import { useUIStore } from "../../stores/uiStore";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

function TabIcon({
  name,
  color,
  focused,
  center = false,
}: {
  name: FeatherName;
  color: string;
  focused: boolean;
  center?: boolean;
}) {
  const active = focused || center;

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: center ? 56 : focused ? 48 : 42,
        height: center ? 56 : focused ? 36 : 34,
        marginTop: center ? -26 : 0,
        borderRadius: center ? 28 : 14,
        backgroundColor: active ? "#F5A623" : "transparent",
        borderWidth: center ? 4 : focused ? 1 : 0,
        borderColor: center ? "rgba(255,255,255,0.72)" : focused ? "#FFD70055" : "transparent",
        shadowColor: active ? "#F5A623" : "transparent",
        shadowOffset: { width: 0, height: center ? 10 : 6 },
        shadowOpacity: active ? 0.28 : 0,
        shadowRadius: center ? 18 : 12,
        elevation: active ? 8 : 0,
      }}
    >
      <Feather name={name} size={center ? 25 : focused ? 22 : 20} color={active ? "#fff" : color} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const isDark = themeMode === "dark";
  const tabBarBackground = isDark ? "rgba(26,26,26,0.82)" : "rgba(255,255,255,0.88)";
  const icon = (name: FeatherName, center = false) => ({ color, focused }: { color: string; focused: boolean }) => (
    <TabIcon name={name} color={color} focused={focused} center={center} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tabBarBackground,
          borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(245,166,35,0.20)",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 92 : 82,
          paddingBottom: Platform.OS === "ios" ? 24 : 12,
          paddingTop: 10,
          marginHorizontal: 12,
          marginBottom: Platform.OS === "ios" ? 6 : 10,
          borderRadius: 28,
          position: "absolute",
          overflow: "visible",
          shadowColor: isDark ? "#000" : "#4B3508",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.48 : 0.14,
          shadowRadius: 22,
          elevation: 20,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: FONTS.sans,
          fontWeight: "700",
          letterSpacing: 0,
          marginTop: 2,
          width: 74,
          textAlign: "center",
        },
        tabBarItemStyle: {
          flex: 1,
          paddingTop: 2,
          minWidth: 64,
        },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen name="feed" options={{ title: t("tab_feed"), tabBarIcon: icon("home") }} />
      <Tabs.Screen name="colmeia" options={{ title: t("tab_colmeia"), tabBarIcon: icon("hexagon") }} />
      <Tabs.Screen name="index" options={{ title: t("tab_chat"), tabBarIcon: icon("message-circle", true) }} />
      <Tabs.Screen name="inbox" options={{ title: t("tab_inbox"), tabBarIcon: icon("message-square") }} />
      <Tabs.Screen name="communities" options={{ title: t("tab_communities"), tabBarIcon: icon("users") }} />

      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="mood" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="news" options={{ href: null }} />
    </Tabs>
  );
}
