import { Tabs } from "expo-router";
import { Text } from "react-native";
import { COLORS } from "../../lib/theme";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🐝" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title: "Missões",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mood"
        options={{
          title: "Humor",
          tabBarIcon: ({ focused }) => <TabIcon emoji="💛" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
