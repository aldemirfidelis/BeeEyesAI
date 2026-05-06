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
        width: 44,
        height: 32,
        borderRadius: 16,
        backgroundColor: focused ? color + "22" : "transparent",
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
    ? "rgba(20,20,20,0.95)"
    : "rgba(255,255,255,0.96)";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tabBarBackground,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: Platform.OS === "ios" ? 82 : 72,
          paddingBottom: Platform.OS === "ios" ? 22 : 10,
          paddingTop: 8,
          // Subtle top shadow line for depth
          shadowColor: isDark ? "#000" : "#1A1A1A",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.4 : 0.06,
          shadowRadius: 12,
          elevation: 12,
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
        name="missions"
        options={{
          title: t("tab_missions"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="zap" color={color} focused={focused} />
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
