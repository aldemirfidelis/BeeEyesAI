import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { FONTS } from "@mobile/lib/theme";
import { resolveAssetUrl } from "@mobile/lib/api";

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  backgroundColor: string;
  color: string;
  style?: ViewStyle;
};

export function UserAvatar({ name, avatarUrl, size = 40, backgroundColor, color, style }: UserAvatarProps) {
  const initial = name?.[0]?.toUpperCase() || "?";
  const resolvedUrl = resolveAssetUrl(avatarUrl);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor }, style]}>
      {resolvedUrl ? (
        <Image source={{ uri: resolvedUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <Text style={{ fontFamily: FONTS.display, fontSize: size * 0.38, fontWeight: "700", color }}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
});
