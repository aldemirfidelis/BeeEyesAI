import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { FONTS, getThemeColors } from "../../lib/theme";
import { useUIStore } from "../../stores/uiStore";

export default function SettingsScreen() {
  const themeMode = useUIStore((state) => state.themeMode);
  const profileImageUri = useUIStore((state) => state.profileImageUri);
  const setThemeMode = useUIStore((state) => state.setThemeMode);
  const setProfileImageUri = useUIStore((state) => state.setProfileImageUri);
  const [imageInput, setImageInput] = useState(profileImageUri ?? "");

  const colors = getThemeColors(themeMode);
  const styles = makeStyles(colors);

  async function handleSaveImage() {
    const clean = imageInput.trim();
    if (!clean) {
      Alert.alert("Foto de perfil", "Informe uma URL valida para salvar a foto.");
      return;
    }
    await setProfileImageUri(clean);
    Alert.alert("Foto atualizada", "Sua foto de perfil foi salva.");
  }

  async function handleRemoveImage() {
    await setProfileImageUri(null);
    setImageInput("");
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
            <Text style={styles.previewHelp}>Cole a URL de uma imagem para colocar ou trocar a foto.</Text>
          </View>

          <TextInput
            style={styles.input}
            value={imageInput}
            onChangeText={setImageInput}
            placeholder="https://..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.rowButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveImage}>
              <Text style={styles.primaryButtonText}>Salvar foto</Text>
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
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      color: colors.foreground,
      fontFamily: FONTS.sans,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
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
  });
}
