import { Tabs } from "expo-router";
import { View, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getThemeColors } from "../../lib/theme";
import { useUIStore } from "../../stores/uiStore";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

function TabIcon({
  name,
  color,
  focused,
}: {
  name: FeatherName;
  color: string;
  focused: boolean;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: focused ? 48 : 42,
        height: focused ? 36 : 34,
        borderRadius: 14,
        backgroundColor: focused ? "#F5A623" : "transparent",
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? "#FFD70055" : "transparent",
        shadowColor: focused ? "#F5A623" : "transparent",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: focused ? 0.24 : 0,
        shadowRadius: 12,
        elevation: focused ? 5 : 0,
      }}
    >
      <Feather name={name} size={focused ? 22 : 20} color={focused ? "#1A1A1A" : color} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const isDark = themeMode === "dark";

  const tabBarBackground = isDark
    ? "rgba(26,26,26,0.88)"
    : "rgba(255,255,255,0.95)";

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
          overflow: "hidden",
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
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarItemStyle: {
          flex: 1,
          paddingTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_chat"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="message-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: t("tab_feed"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="layout" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="colmeia"
        options={{
          title: t("tab_colmeia"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="grid" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("tab_inbox"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="mail" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: t("tab_communities"),
          tabBarLabelStyle: { fontSize: 9, fontWeight: "700", letterSpacing: 0 },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="users" color={color} focused={focused} />
          ),
        }}
      />

      {/* Hidden from tab bar — accessible via header */}
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="mood" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="news" options={{ href: null }} />
    </Tabs>
  );
}
