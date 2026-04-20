import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { FONTS, COLORS } from "@mobile/lib/theme";

export default function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Essa tela falhou ao abrir</Text>
      <Text style={styles.body} numberOfLines={6}>
        {error?.message || "Ocorreu um erro inesperado."}
      </Text>
      <TouchableOpacity style={styles.button} onPress={retry}>
        <Text style={styles.buttonText}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.foreground,
    textAlign: "center",
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: "center",
  },
  button: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
  },
});
