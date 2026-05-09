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
        width: 46,
        height: 34,
        borderRadius: 12,
        backgroundColor: focused ? color + "24" : "transparent",
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? color + "33" : "transparent",
      }}
    >
      <Feather name={name} size={focused ? 22 : 20} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const isDark = themeMode === "dark";

  const tabBarBackground = isDark
    ? "rgba(32,26,16,0.96)"
    : "rgba(255,255,255,0.96)";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tabBarBackground,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 86 : 76,
          paddingBottom: Platform.OS === "ios" ? 22 : 10,
          paddingTop: 8,
          marginHorizontal: 12,
          marginBottom: Platform.OS === "ios" ? 6 : 10,
          borderRadius: 24,
          position: "absolute",
          overflow: "hidden",
          // Subtle top shadow line for depth
          shadowColor: isDark ? "#000" : "#4B3508",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.45 : 0.12,
          shadowRadius: 18,
          elevation: 18,
        },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
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
