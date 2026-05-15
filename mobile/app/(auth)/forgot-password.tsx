import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { api } from "../../lib/api";
import BeeEyes from "../../components/BeeEyes";
import { COLORS } from "../../lib/theme";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    if (!email.trim()) {
      Alert.alert("Atenção", "Informe o e-mail cadastrado.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/password-reset/request", { email });
      Alert.alert("Verifique seu e-mail", "Se o e-mail existir, enviaremos um link de recuperação.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Erro", err.response?.data?.message || "Não foi possível solicitar recuperação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#FFF8E7", "#FFE566", "#F5C842"]} style={styles.hero}>
        <BeeEyes expression="curious" size={92} />
        <Text style={styles.brandName}>Recuperar senha</Text>
        <Text style={styles.brandTagline}>A Bee envia um link seguro para seu e-mail.</Text>
      </LinearGradient>
      <View style={styles.card}>
        <Text style={styles.inputLabel}>E-mail cadastrado</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="voce@email.com"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleRequest} disabled={loading}>
          <Text style={styles.primaryBtnText}>{loading ? "Enviando..." : "Enviar link"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5C842" },
  hero: { flex: 0.42, alignItems: "center", justifyContent: "flex-end", paddingBottom: 28 },
  brandName: { fontFamily: "System", fontSize: 28, fontWeight: "800", color: "#1A1A1A", marginTop: 8 },
  brandTagline: { fontFamily: "System", fontSize: 13, color: "#6B5000", marginTop: 4, textAlign: "center", paddingHorizontal: 28 },
  card: { flex: 0.58, backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28 },
  inputLabel: { fontFamily: "System", fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 8 },
  input: { backgroundColor: "#F8F6F0", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15, fontSize: 15, color: "#1A1A1A", borderWidth: 1.5, borderColor: "#EDE9E0" },
  primaryBtn: { marginTop: 18, borderRadius: 16, backgroundColor: "#F5C842", paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { fontFamily: "System", fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  btnDisabled: { opacity: 0.6 },
  backBtn: { marginTop: 18, alignItems: "center" },
  backText: { fontFamily: "System", fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },
});
