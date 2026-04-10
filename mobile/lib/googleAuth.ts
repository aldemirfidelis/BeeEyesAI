import { Platform } from "react-native";

// @react-native-google-signin requer Development Build (não funciona no Expo Go)
// Para usar Google Sign-In execute: npx expo run:android
let GoogleSignin: any = null;
try {
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch {
  // módulo nativo não disponível (Expo Go)
}

let isConfigured = false;

export function configureGoogleSignin() {
  if (isConfigured || Platform.OS === "web" || !GoogleSignin) {
    return;
  }

  GoogleSignin.configure({
    scopes: ["email", "profile"],
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  isConfigured = true;
}

export async function signInWithGoogleNative(): Promise<string | null> {
  if (!GoogleSignin) {
    console.warn("Google Sign-In não disponível no Expo Go. Use: npx expo run:android");
    return null;
  }

  configureGoogleSignin();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const signInResult = await GoogleSignin.signIn();
  if (signInResult.type !== "success") {
    return null;
  }

  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}
