import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { FONTS, getThemeColors } from "@mobile/lib/theme";
import { useUIStore } from "@mobile/stores/uiStore";

export default function SettingsScreen() {
  const themeMode = useUIStore((state) => state.themeMode);
  const profileImageUri = useUIStore((state) => state.profileImageUri);
  const setThemeMode = useUIStore((state) => state.setThemeMode);
  const setProfileImageUri = useUIStore((state) => state.setProfileImageUri);

  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  async function handlePickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Permita acesso a galeria para escolher sua foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const processed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 512, height: 512 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
    );

    await setProfileImageUri(processed.uri);
    Alert.alert("Foto atualizada", "Sua foto foi ajustada e comprimida com sucesso.");
  }

  async function handleRemoveImage() {
    await setProfileImageUri(null);
    Alert.alert("Foto removida", "Sua foto de perfil foi removida.");
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Configuracoes</Text>
          <View style={{ width: 68 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Foto de perfil</Text>
          <View style={styles.previewRow}>
            <View style={styles.avatar}>
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarPlaceholder}>Sem foto</Text>
              )}
            </View>
            <Text style={styles.previewHelp}>
              Escolha uma foto da galeria. O app aplica ajuste e compressao automaticamente para avatar.
            </Text>
          </View>

          <View style={styles.rowButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={handlePickFromGallery}>
              <Text style={styles.primaryButtonText}>Escolher da galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleRemoveImage}>
              <Text style={styles.secondaryButtonText}>Remover</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aparencia</Text>
          <Text style={styles.cardSubTitle}>Escolha entre modo claro ou escuro.</Text>
          <View style={styles.themeButtons}>
            <TouchableOpacity
              style={[styles.themeButton, themeMode === "light" && styles.themeButtonActive]}
              onPress={() => setThemeMode("light")}
            >
              <Text style={[styles.themeButtonText, themeMode === "light" && styles.themeButtonTextActive]}>
                Modo claro
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeButton, themeMode === "dark" && styles.themeButtonActive]}
              onPress={() => setThemeMode("dark")}
            >
              <Text style={[styles.themeButtonText, themeMode === "dark" && styles.themeButtonTextActive]}>
                Modo escuro
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Outras configuracoes</Text>
          <TouchableOpacity style={styles.linkButton} onPress={() => router.push("/news" as never)}>
            <Text style={styles.linkButtonText}>Abrir central de noticias</Text>
          </TouchableOpacity>
          <Text style={styles.futureItem}>- Notificacoes personalizadas (em breve)</Text>
          <Text style={styles.futureItem}>- Privacidade e seguranca (em breve)</Text>
          <Text style={styles.futureItem}>- Idioma e acessibilidade (em breve)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      gap: 14,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    backButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    backButtonText: {
      fontFamily: FONTS.sans,
      color: colors.foreground,
      fontWeight: "700",
      fontSize: 12,
    },
    title: {
      fontFamily: FONTS.display,
      fontWeight: "700",
      fontSize: 22,
      color: colors.foreground,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    cardTitle: {
      fontFamily: FONTS.sans,
      color: colors.foreground,
      fontWeight: "700",
      fontSize: 16,
    },
    cardSubTitle: {
      fontFamily: FONTS.sans,
      color: colors.muted,
      fontSize: 13,
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    avatarPlaceholder: {
      fontFamily: FONTS.sans,
      color: colors.muted,
      fontSize: 11,
    },
    previewHelp: {
      flex: 1,
      fontFamily: FONTS.sans,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    rowButtons: {
      flexDirection: "row",
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: colors.primary,
      paddingVertical: 11,
      alignItems: "center",
    },
    primaryButtonText: {
      fontFamily: FONTS.sans,
      fontWeight: "700",
      color: "#1A1A1A",
      fontSize: 13,
    },
    secondaryButton: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: colors.secondary,
      paddingVertical: 11,
      alignItems: "center",
    },
    secondaryButtonText: {
      fontFamily: FONTS.sans,
      fontWeight: "700",
      color: colors.foreground,
      fontSize: 13,
    },
    themeButtons: {
      flexDirection: "row",
      gap: 10,
    },
    themeButton: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 11,
      alignItems: "center",
      backgroundColor: colors.background,
    },
    themeButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "26",
    },
    themeButtonText: {
      fontFamily: FONTS.sans,
      color: colors.foreground,
      fontWeight: "700",
      fontSize: 13,
    },
    themeButtonTextActive: {
      color: colors.primaryDark,
    },
    futureItem: {
      fontFamily: FONTS.sans,
      color: colors.muted,
      fontSize: 13,
      lineHeight: 20,
    },
    linkButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 11,
      alignItems: "center",
    },
    linkButtonText: {
      fontFamily: FONTS.sans,
      fontWeight: "700",
      color: colors.foreground,
      fontSize: 13,
    },
  });
}

