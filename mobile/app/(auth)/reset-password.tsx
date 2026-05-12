import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";
import BeeEyes from "../../components/BeeEyes";
import { COLORS } from "../../lib/theme";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!params.token || !password.trim()) {
      Alert.alert("Atenção", "Link inválido ou senha vazia.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/password-reset/confirm", { token: params.token, password });
      Alert.alert("Senha atualizada", "Entre novamente com sua nova senha.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err: any) {
      Alert.alert("Erro", err.response?.data?.message || "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <LinearGradient colors={["#FFF8E7", "#FFE566", "#F5C842"]} style={styles.hero}>
        <BeeEyes expression="happy" size={92} />
        <Text style={styles.brandName}>Nova senha</Text>
      </LinearGradient>
      <View style={styles.card}>
        <Text style={styles.inputLabel}>Crie sua nova senha</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="mínimo 8 caracteres, letra e número"
          placeholderTextColor={COLORS.muted}
          secureTextEntry
        />
        <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleReset} disabled={loading}>
          <Text style={styles.primaryBtnText}>{loading ? "Salvando..." : "Redefinir senha"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5C842" },
  hero: { flex: 0.42, alignItems: "center", justifyContent: "flex-end", paddingBottom: 28 },
  brandName: { fontFamily: "System", fontSize: 28, fontWeight: "800", color: "#1A1A1A", marginTop: 8 },
  card: { flex: 0.58, backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28 },
  inputLabel: { fontFamily: "System", fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 8 },
  input: { backgroundColor: "#F8F6F0", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15, fontSize: 15, color: "#1A1A1A", borderWidth: 1.5, borderColor: "#EDE9E0" },
  primaryBtn: { marginTop: 18, borderRadius: 16, backgroundColor: "#F5C842", paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { fontFamily: "System", fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  btnDisabled: { opacity: 0.6 },
});
