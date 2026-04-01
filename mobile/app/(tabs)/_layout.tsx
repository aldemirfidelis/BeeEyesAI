import { Tabs } from "expo-router";
import { Alert, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getThemeColors } from "../../lib/theme";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

function TabIcon({ name, color, focused }: { name: FeatherName; color: string; focused: boolean }) {
  return <Feather name={name} size={focused ? 23 : 21} color={color} />;
}

export default function TabsLayout() {
  const themeMode = useUIStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const userLevel = useAuthStore((s) => s.user?.level ?? 1);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
        tabBarItemStyle: {
          flex: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, focused }) => <TabIcon name="message-circle" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) => <TabIcon name="layout" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title: "Missões",
          tabBarIcon: ({ color, focused }) => <TabIcon name="zap" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Mensagens",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="mail" color={userLevel >= 2 ? color : colors.muted} focused={focused} />
          ),
          tabBarButton: userLevel >= 2
            ? undefined
            : (props) => (
                <TouchableOpacity
                  {...props}
                  onPress={() =>
                    Alert.alert(
                      "🔒 Bloqueado",
                      "Mensagens Diretas são desbloqueadas no Nível 2.\nComplete mais missões para subir de nível!",
                      [{ text: "Entendido", style: "cancel" }]
                    )
                  }
                  style={[props.style, { opacity: 0.45 }]}
                />
              ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: "Comunidades",
          tabBarIcon: ({ color, focused }) => <TabIcon name="users" color={color} focused={focused} />,
        }}
      />
      {/* Ocultos da tab bar — acessíveis via header */}
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="mood" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="news" options={{ href: null }} />
    </Tabs>
  );
}
