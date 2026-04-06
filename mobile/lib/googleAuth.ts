import { Platform } from "react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

let isConfigured = false;

export function configureGoogleSignin() {
  if (isConfigured || Platform.OS === "web") {
    return;
  }

  GoogleSignin.configure({
    scopes: ["email", "profile"],
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  isConfigured = true;
}

export async function signInWithGoogleNative() {
  configureGoogleSignin();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const signInResult = await GoogleSignin.signIn();
  if (signInResult.type !== "success") {
    return null;
  }

  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}
