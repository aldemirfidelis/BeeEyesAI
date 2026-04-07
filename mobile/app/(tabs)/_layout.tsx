import { Tabs } from "expo-router";
import { Alert, TouchableOpacity, View, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
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
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const isDark = themeMode === "dark";

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 30 * 1000,
    refetchInterval: 10 * 1000,
  });
  const userLevel = me?.level ?? 1;

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
          title: "Chat",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="message-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="layout" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title: "Missões",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="zap" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Mensagens",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="mail"
              color={userLevel >= 2 ? color : colors.muted}
              focused={focused}
            />
          ),
          tabBarButton:
            userLevel >= 2
              ? undefined
              : ({
                  style,
                  children,
                  accessibilityState,
                  accessibilityLabel,
                  testID,
                }) => (
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        "🔒 Bloqueado",
                        "Mensagens Diretas são desbloqueadas no Nível 2.\nComplete mais missões para subir de nível!",
                        [{ text: "Entendido", style: "cancel" }]
                      )
                    }
                    accessibilityState={accessibilityState}
                    accessibilityLabel={accessibilityLabel}
                    testID={testID}
                    style={[style, { opacity: 0.4 }]}
                  >
                    {children}
                  </TouchableOpacity>
                ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: "Comunidades",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="users" color={color} focused={focused} />
          ),
        }}
      />

      {/* Hidden from tab bar — accessible via header */}
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="mood" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="news" options={{ href: null }} />
    </Tabs>
  );
}
